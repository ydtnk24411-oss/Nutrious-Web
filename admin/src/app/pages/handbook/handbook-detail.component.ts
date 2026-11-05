import { Component, signal, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { HANDBOOK_ARTICLES, HandbookArticle } from '../../shared/data/handbook.data';

@Component({
  selector: 'app-handbook-detail',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './handbook-detail.component.html',
  styleUrl: './handbook-detail.component.css',
})
export class HandbookDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);

  protected readonly allArticles = HANDBOOK_ARTICLES;
  protected currentArticle = signal<HandbookArticle | null>(null);
  protected otherArticles = signal<HandbookArticle[]>([]);

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        const found = HANDBOOK_ARTICLES.find(a => a.slug === slug);
        if (found) {
          this.currentArticle.set(found);
          this.otherArticles.set(HANDBOOK_ARTICLES.filter(a => a.slug !== slug));
        } else {
          // Fallback to first article if not found
          this.currentArticle.set(HANDBOOK_ARTICLES[0]);
          this.otherArticles.set(HANDBOOK_ARTICLES.slice(1));
        }
      } else {
        // No slug -> show first article
        this.currentArticle.set(HANDBOOK_ARTICLES[0]);
        this.otherArticles.set(HANDBOOK_ARTICLES.slice(1));
      }

      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }
}

