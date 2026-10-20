import {Component, input} from '@angular/core';
@Component({selector:'app-menu-icon',standalone:true,template:`<svg viewBox="0 0 24 24" aria-hidden="true">@switch(name()){@case ('dashboard') {<rect x="3" y="3" width="7" height="7" rx="2"></rect><rect x="14" y="3" width="7" height="7" rx="2"></rect><rect x="3" y="14" width="7" height="7" rx="2"></rect><rect x="14" y="14" width="7" height="7" rx="2"></rect>}
@case ('api') {<circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="6" r="2.5"></circle><circle cx="18" cy="18" r="2.5"></circle><path d="m8.2 10.9 7.6-3.8M8.2 13.1l7.6 3.8"></path>}
@case ('applications') {<path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M3 21h18M9 7h2M14 7h1M9 11h2M14 11h1M9 15h6M10 21v-3h4v3"></path>}
@case ('test') {<rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="m8.5 9 4 3-4 3zM15 15h2"></path>}
@case ('history') {<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"></path>}
@case ('reference') {<path d="M4 5.5A3.5 3.5 0 0 1 7.5 4H11v16H7.5A3.5 3.5 0 0 0 4 21V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 4H13v16h3.5A3.5 3.5 0 0 1 20 21V5.5Z"></path>}
@case ('vendor') {<rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"></path>}
@case ('users') {<circle cx="9" cy="8" r="3"></circle><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20M16 5.5a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 3.5 4.4V20"></path>}
@case ('password') {<circle cx="8" cy="15" r="4"></circle><path d="m11 12 8-8M15 8l3 3M17 6l2 2"></path>}
@case ('access') {<path d="M12 3 5 6v5c0 4.7 2.9 8.2 7 10 4.1-1.8 7-5.3 7-10V6l-7-3Z"></path><path d="m8.5 12 2.2 2.2 4.8-5"></path>}
@case ('roles') {<rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="9" cy="10" r="2.5"></circle><path d="M5.5 17a3.5 3.5 0 0 1 7 0M15 9h3M15 13h3"></path>}
@case ('permissions') {<rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"></path>}
@case ('audit') {<path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8M15 5h3a2 2 0 0 1 2 2v5"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><path d="M8 12h6M8 16h3"></path><circle cx="17" cy="17" r="3"></circle><path d="m19.2 19.2 2 2"></path>}@case ('folder') {<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>}
@case ('settings') {<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>}@default {<path d="M3 6h7l2 3h9v12H3Z"/>}}</svg>`,styles:[`:host{display:inline-flex;width:20px;height:20px;align-items:center;justify-content:center}svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}`]})
export class MenuIconComponent {readonly name=input('folder');}
