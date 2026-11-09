import { Component } from '@angular/core';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { CartDrawerComponent } from '../cart-drawer/cart-drawer.component';
import { AuthModalComponent } from '../auth-modal/auth-modal.component';
import { ChatbotComponent } from '../chatbot/chatbot.component';
import { BuyNowModalComponent } from '../buy-now-modal/buy-now-modal.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    HeaderComponent,
    FooterComponent,
    CartDrawerComponent,
    AuthModalComponent,
    ChatbotComponent,
    BuyNowModalComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {}
