import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';

function toCartProduct(p: ApiProduct): XanhLaProduct {
  return {
    id: p._id, name: p.name, slug: p.slug, price: p.price,
    priceNumber: p.priceNumber, image: p.image,
    category: p.category as 'Vegetables' | 'Fruits' | 'Meat',
    categoryVi: p.categoryVi, description: p.description,
    container: p.container, cutType: p.cutType, cutting: p.cutting,
    packSize: p.packSize, packaging: p.packaging, preparation: p.preparation,
    quantity: p.quantity, ripeness: p.ripeness, sizeGroup: p.sizeGroup,
    thickness: p.thickness, type: p.type, weight: p.weight,
    options: p.options,
  };
}

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './menus.component.html',
  styleUrl: './menus.component.css',
})
export class MenusComponent implements OnInit {
  protected cart       = inject(CartService);
  private productApi   = inject(ProductApiService);

  protected allProducts = signal<ApiProduct[]>([]);
  protected loading     = signal(true);
  protected error       = signal('');

  // Group by categoryVi — same logic as ordering page
  protected sections = computed(() => {
    const all = this.allProducts();
    const groups: Record<string, ApiProduct[]> = {};
    for (const p of all) {
      const key = p.categoryVi || p.category;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return Object.entries(groups).map(([title, items]) => ({ title, items }));
  });

  ngOnInit(): void {
    this.productApi.getAll({ limit: 50, sort: 'createdAt' }).subscribe({
      next:  (res) => { this.allProducts.set(res.data); this.loading.set(false); },
      error: ()    => { this.error.set('Không thể tải sản phẩm.'); this.loading.set(false); },
    });
  }

  addToCart(prod: ApiProduct): void {
    this.cart.addItem(toCartProduct(prod), 1);
  }
}
