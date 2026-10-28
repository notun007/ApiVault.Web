import { NgTemplateOutlet } from '@angular/common';
import { Component, effect, inject, input, output, signal, DestroyRef } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEntry, childrenOf } from '../../core/models/navigation.models';
import { MenuIconComponent } from './menu-icon.component';

@Component({
  selector:'app-navigation-tree', standalone:true,
  imports:[NgTemplateOutlet, RouterLink, RouterLinkActive, MenuIconComponent],
  template: `
    <ng-container *ngTemplateOutlet="branch; context: { $implicit: null, depth: 0 }" />
    <ng-template #branch let-parent let-depth="depth">
      <ul [class.nested]="depth > 0">
        @for (item of children(parent); track item.id) {
          <li>
            @if (item.isGroup) {
              <button type="button" class="group" [class.contains-active]="containsActive(item.id)" [attr.aria-expanded]="!compact() && open().has(item.id)" [attr.aria-controls]="'menu-' + item.id" [attr.title]="compact() ? item.name : null" (click)="toggle(item.id)">
                <app-menu-icon [name]="item.icon" /><span class="label">{{item.name}}</span>
                <svg class="chevron" [class.open]="open().has(item.id)" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
              </button>
              <div [id]="'menu-' + item.id" [hidden]="compact() || !open().has(item.id)">
                <ng-container *ngTemplateOutlet="branch; context: { $implicit: item.id, depth: depth + 1 }" />
              </div>
            } @else {
              <a [routerLink]="item.route" routerLinkActive="active" [routerLinkActiveOptions]="{exact:item.route === '/dashboard'}" ariaCurrentWhenActive="page" [attr.title]="compact() ? item.name : null" (click)="selected.emit()"><app-menu-icon [name]="item.icon"/><span class="label">{{item.name}}</span></a>
            }
          </li>
        }
      </ul>
    </ng-template>`,
  styles: [`
    :host{display:block}ul{list-style:none;margin:0;padding:0;display:grid;gap:3px}li{min-width:0}.nested{position:relative;margin:3px 0 9px 16px;padding:0 0 0 13px;border-left:1px solid #c9dce8}
    a,.group{box-sizing:border-box;position:relative;display:flex;align-items:center;gap:11px;width:100%;min-height:42px;padding:9px 11px;border:1px solid transparent;border-radius:8px;background:transparent;color:#233f59;text-align:left;text-decoration:none;font:inherit;font-size:12px;line-height:1.25;cursor:pointer;transition:color .16s ease,background .16s ease,border-color .16s ease,box-shadow .16s ease,transform .16s ease}
    .group{font-weight:700;color:#183c5c}a{font-weight:520}a:hover,.group:hover{border-color:#e0ebf1;background:rgba(255,255,255,.78);color:#0f5278}a:hover{transform:translateX(1px)}
    a.active{border-color:#c9e0eb;background:#e5f1f8;box-shadow:inset 3px 0 #0aa0b1,0 2px 6px rgba(31,75,106,.045);color:#0d5b82;font-weight:700}.contains-active{color:#0b6489}
    a.active::after{content:'';position:absolute;right:10px;width:5px;height:5px;border-radius:50%;background:#17a6b5;box-shadow:0 0 0 3px rgba(23,166,181,.1)}
    app-menu-icon{flex:0 0 auto;color:#316f98;transition:color .16s ease}.group app-menu-icon{color:#2c739f}a:hover app-menu-icon,.group:hover app-menu-icon,a.active app-menu-icon{color:#0b8298}
    .label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chevron{width:14px;height:14px;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transition:transform .18s ease}.chevron.open{transform:rotate(90deg)}
    a:focus-visible,.group:focus-visible{outline:2px solid rgba(10,155,176,.55);outline-offset:2px}
    :host(.compact) ul{gap:6px}:host(.compact) .label,:host(.compact) .chevron{display:none}:host(.compact) a,:host(.compact) .group{justify-content:center;min-height:44px;padding:10px}:host(.compact) a.active,:host(.compact) .group.contains-active{border-color:#c9e0eb;background:#e5f1f8;box-shadow:inset 0 3px #0aa0b1}:host(.compact) a.active::after{display:none}
    @media(prefers-reduced-motion:reduce){a,.group,.chevron,app-menu-icon{transition:none}a:hover{transform:none}}
  `],
  host:{'[class.compact]':'compact()'}
})
export class NavigationTreeComponent {
  readonly items = input.required<NavigationEntry[]>();
  readonly compact = input(false);
  readonly selected = output<void>();
  readonly expand = output<void>();
  readonly open = signal(new Set<string>());
  private readonly router = inject(Router);
  private readonly route = signal(this.router.url);
  constructor() {
    this.router.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(event => {if(event instanceof NavigationEnd)this.route.set(event.urlAfterRedirects);});
    effect(() => {
      const items=this.items(); const url=this.route().split('?')[0];
      const page=items.filter(x=>x.route && (url===x.route || url.startsWith(x.route+'/'))).sort((a,b)=>b.route!.length-a.route!.length)[0];
      const ancestors=new Set<string>();let parent=page?.parentId;
      while(parent){ancestors.add(parent);parent=items.find(x=>x.id===parent)?.parentId ?? null;}
      this.open.update(current=>new Set([...current,...ancestors]));
    });
  }
  children(parent:string|null){return childrenOf(this.items(),parent);}
  containsActive(id:string):boolean {
    return this.children(id).some(x=>x.isGroup ? this.containsActive(x.id) : !!x.route && (this.route().split('?')[0]===x.route || this.route().startsWith(x.route+'/')));
  }
  toggle(id:string){const wasCompact=this.compact();if(wasCompact)this.expand.emit();this.open.update(current=>{const next=new Set(current);if(next.has(id)&&!wasCompact)next.delete(id);else next.add(id);return next;});}
}
