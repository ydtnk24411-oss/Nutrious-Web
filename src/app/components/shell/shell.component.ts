import { Component } from '@angular/core';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { CartDrawerComponent } from '../cart-drawer/cart-drawer.component';
import { AuthModalComponent } from '../auth-modal/auth-modal.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [HeaderComponent, FooterComponent, CartDrawerComponent, AuthModalComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {}
