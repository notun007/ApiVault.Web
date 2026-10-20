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
    :host{display:block}ul{list-style:none;margin:0;padding:0;display:grid;gap:4px}.nested{margin:4px 0 8px 17px;padding-left:12px;border-left:1px solid #ffffff28}
    a,.group{box-sizing:border-box;display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:10px 12px;border:1px solid transparent;border-radius:9px;background:transparent;color:#ffffffcf;text-align:left;text-decoration:none;font:inherit;font-size:12px;cursor:pointer}
    .group{font-weight:650;color:#fff}a:hover,.group:hover{background:#ffffff12;color:#fff}a.active{background:#ffffff21;border-color:#ffffff26;box-shadow:inset 3px 0 var(--sidebar-accent);color:#fff}.contains-active{color:#b9ffef}
    .label{flex:1;min-width:0}.chevron{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;transition:transform .15s}.chevron.open{transform:rotate(90deg)}
    a:focus-visible,.group:focus-visible{outline:2px solid var(--sidebar-accent);outline-offset:2px}
    :host(.compact) .label,:host(.compact) .chevron{display:none}:host(.compact) a,:host(.compact) .group{justify-content:center;padding:10px}
    @media(prefers-reduced-motion:reduce){.chevron{transition:none}}
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
