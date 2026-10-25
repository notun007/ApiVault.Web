import { confirmMutation } from '../../shared/confirm-mutation';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationEntry, MENU_ICONS, childrenOf } from '../../core/models/navigation.models';
import { NavigationService } from '../../core/services/navigation.service';
import { ToastService } from '../../core/services/toast.service';
import { readProblem } from '../../core/http/error.interceptor';
import { MenuIconComponent } from '../../shared/components/menu-icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({selector:'app-menu-management',standalone:true,imports:[ReactiveFormsModule,MenuIconComponent,PageHeaderComponent],templateUrl:'./menu-management.component.html',styleUrl:'./menu-management.component.scss'})
export class MenuManagementComponent {
  private readonly service=inject(NavigationService);
  private readonly toast=inject(ToastService);
  private readonly fb=inject(FormBuilder);
  readonly items=signal<NavigationEntry[]>([]);
  readonly selectedId=signal('');
  readonly loading=signal(true);
  readonly saving=signal(false);
  readonly dirty=signal(false);
  readonly error=signal('');
  readonly icons=MENU_ICONS;
  private revision='';
  readonly editor=this.fb.nonNullable.group({name:['',[Validators.required,Validators.maxLength(150)]],icon:['folder'],parentId:[''],isActive:[true]});
  readonly selected=computed(()=>this.items().find(x=>x.id===this.selectedId()));
  readonly rows=computed(()=>{
    const result:{item:NavigationEntry;depth:number}[]=[];
    const walk=(parent:string|null,depth:number)=>{for(const item of childrenOf(this.items(),parent)){result.push({item,depth});walk(item.id,depth+1);}};
    walk(null,0);return result;
  });
  readonly parents=computed(()=>this.items().filter(x=>x.isGroup && x.id!==this.selectedId() && !this.descendant(x.id,this.selectedId()) && this.canParent(x)));
  constructor(){this.reload();}
  reload(){
    this.loading.set(true);this.error.set('');
    this.service.management().subscribe({next:layout=>{this.items.set(layout.items);this.revision=layout.revision;this.selectedId.set('');this.dirty.set(false);this.loading.set(false);this.editor.reset();},error:(e:HttpErrorResponse)=>{this.error.set(readProblem(e,'Could not load the menu. Restart the API after installing this update.'));this.loading.set(false);}});
  }
  descendant(id:string,ancestor:string):boolean {let item=this.items().find(x=>x.id===id);while(item?.parentId){if(item.parentId===ancestor)return true;item=this.items().find(x=>x.id===item!.parentId);}return false;}
  depth(id:string):number {let level=0;let item=this.items().find(x=>x.id===id);while(item?.parentId){level++;item=this.items().find(x=>x.id===item!.parentId);}return level;}
  private canParent(parent:NavigationEntry):boolean {const selected=this.selected();if(!selected?.isGroup)return true;return this.depth(parent.id)===0 && !this.items().some(x=>x.isGroup && this.descendant(x.id,selected.id));}
  initialize(){if(this.loading())return;if(!confirmMutation('create', 'the initial workspace menu'))return;this.loading.set(true);this.service.initialize().subscribe({next:()=>{this.reload();this.service.load();},error:(e:HttpErrorResponse)=>{this.error.set(readProblem(e,'Could not set up the menu.'));this.loading.set(false);}});}
  select(item:NavigationEntry){if(this.selectedId()&&this.editor.dirty&&!this.apply())return;this.selectedId.set(item.id);this.editor.reset({name:item.name,icon:item.icon,parentId:item.parentId??'',isActive:item.isActive});}
  addGroup(subgroup=false){
    if(this.selectedId()&&this.editor.dirty&&!this.apply())return;
    const parent=subgroup?this.selected():null;
    if(subgroup&&(!parent?.isGroup||this.depth(parent.id)>0))return;
    const item:NavigationEntry={id:crypto.randomUUID(),name:subgroup?'New subgroup':'New group',route:null,icon:'folder',parentId:parent?.id??null,displayOrder:Math.max(0,...childrenOf(this.items(),parent?.id??null).map(x=>x.displayOrder))+10,isActive:true,isGroup:true};
    this.items.update(items=>[...items,item]);this.dirty.set(true);this.select(item);
  }
  apply():boolean {
    if(!this.selected())return true;
    if(this.editor.invalid||!this.editor.controls.name.value.trim()){this.editor.markAllAsTouched();this.error.set('Enter a name of up to 150 characters.');return false;}
    const value=this.editor.getRawValue();const selected=this.selected()!;
    const parentId=value.parentId||null;
    if(parentId && !this.parents().some(x=>x.id===parentId)){this.error.set('Choose a valid parent. Only two group levels are supported.');return false;}
    this.items.update(items=>items.map(x=>x.id===selected.id?{...x,...value,name:value.name.trim(),parentId,displayOrder:parentId===selected.parentId?x.displayOrder:Math.max(0,...childrenOf(items,parentId).map(y=>y.displayOrder))+10}:x));
    this.editor.markAsPristine();this.dirty.set(true);this.error.set('');return true;
  }
  move(item:NavigationEntry,offset:number){
    if(this.selectedId()&&this.editor.dirty&&!this.apply())return;
    const siblings=childrenOf(this.items(),item.parentId);const index=siblings.findIndex(x=>x.id===item.id);const target=index+offset;if(target<0||target>=siblings.length)return;
    [siblings[index],siblings[target]]=[siblings[target],siblings[index]];const orders=new Map(siblings.map((x,i)=>[x.id,i*10]));
    this.items.update(items=>items.map(x=>orders.has(x.id)?{...x,displayOrder:orders.get(x.id)!}:x));this.dirty.set(true);
  }
  atBoundary(item:NavigationEntry,offset:number){const siblings=childrenOf(this.items(),item.parentId);const i=siblings.findIndex(x=>x.id===item.id)+offset;return i<0||i>=siblings.length;}
  save(){
    if(this.saving()||!this.apply())return;
    if(!confirmMutation('save', 'menu changes for the entire workspace'))return;
    this.saving.set(true);this.error.set('');
    this.service.save({revision:this.revision,items:this.items()}).subscribe({next:layout=>{this.items.set(layout.items);this.revision=layout.revision;this.dirty.set(false);this.saving.set(false);this.service.load();this.toast.success('Menu saved for the workspace');},error:(e:HttpErrorResponse)=>{this.error.set(readProblem(e,'Could not save the menu.'));this.saving.set(false);}});
  }
}
