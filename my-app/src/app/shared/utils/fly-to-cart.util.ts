/**
 * Hiệu ứng hoạt họa bay sản phẩm vào giỏ hàng (Fly to Cart Animation)
 * Tạo hình ảnh tròn của sản phẩm bay từ vị trí vừa bấm lên biểu tượng giỏ hàng trên Header,
 * kèm hiệu ứng nhún (bounce) và phù hiệu +1, không làm gián đoạn trải nghiệm của người dùng.
 * Tốc độ được điều chỉnh thích ứng theo khoảng cách để người dùng luôn kịp quan sát rõ ràng.
 */
export function animateFlyToCart(source?: Event | HTMLElement, imageUrl?: string): void {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let startX = window.innerWidth / 2;
    let startY = window.innerHeight / 2;

    let targetEl: HTMLElement | null = null;
    if (source instanceof HTMLElement) {
      targetEl = source;
    } else if (source && 'currentTarget' in source && (source as any).currentTarget instanceof HTMLElement) {
      targetEl = (source as any).currentTarget as HTMLElement;
    } else if (source && 'target' in source && (source as any).target instanceof HTMLElement) {
      targetEl = (source as any).target as HTMLElement;
    }

    if (targetEl) {
      const card = targetEl.closest('.xanhla-prod-card, .coop-product-card, .coop-flash-card, .bn-dialog, .product-detail, .ord-section');
      const imgInCard = card ? card.querySelector('img') : null;
      const rect = imgInCard ? imgInCard.getBoundingClientRect() : targetEl.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
      if (!imageUrl && imgInCard && imgInCard.src) {
        imageUrl = imgInCard.src;
      }
    } else if (source && 'clientX' in (source as MouseEvent)) {
      const me = source as MouseEvent;
      startX = me.clientX;
      startY = me.clientY;
    }

    // Biểu tượng giỏ hàng trên Header
    const cartBtn = document.getElementById('header-cart-btn')
      || document.querySelector('.xanhla-cart-button')
      || document.querySelector('.xl-icon-btn[aria-label="Xem giỏ hàng"]');

    let endX = window.innerWidth - 60;
    let endY = 40;

    if (cartBtn) {
      const cartRect = cartBtn.getBoundingClientRect();
      endX = cartRect.left + cartRect.width / 2;
      endY = cartRect.top + cartRect.height / 2;
    }

    // Tính toán khoảng cách bay để chuẩn hóa thời lượng mượt mà, vừa mắt
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.hypot(deltaX, deltaY);

    // Thời lượng thích ứng (880ms - 1100ms) để khi ở danh mục xa cũng bay êm ái, dễ quan sát
    const duration = Math.min(1100, Math.max(880, Math.round(distance * 0.95)));

    // Tạo phần tử bay (kích thước 54px rõ ràng, bóng mờ nổi bật)
    const flyer = document.createElement('div');
    flyer.className = 'fly-to-cart-element';
    Object.assign(flyer.style, {
      position: 'fixed',
      zIndex: '9999999',
      left: `${startX - 27}px`,
      top: `${startY - 27}px`,
      width: '54px',
      height: '54px',
      borderRadius: '50%',
      backgroundColor: '#ffffff',
      backgroundImage: imageUrl ? `url("${imageUrl}")` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      border: '3px solid #16a34a',
      boxShadow: '0 10px 28px rgba(0,0,0,0.3), 0 0 0 2px rgba(255,255,255,0.95)',
      pointerEvents: 'none',
      willChange: 'transform, opacity',
    });

    if (!imageUrl) {
      flyer.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:24px">🛒</span>`;
    }

    document.body.appendChild(flyer);

    // Điểm uốn cong tự nhiên của đường bay hình vòng cung lên cao
    const midX = deltaX * 0.48;
    const midY = deltaY < 0 ? deltaY * 0.65 - 90 : deltaY * 0.35 - 90;

    // Keyframes: Khởi đầu phóng to nhẹ (scale 1.15) để mắt nhận diện rõ ràng trước khi lướt lên giỏ
    const keyframes = [
      {
        transform: 'translate(0px, 0px) scale(0.7)',
        opacity: 0.85,
      },
      {
        transform: `translate(${deltaX * 0.08}px, ${deltaY * 0.08 - 20}px) scale(1.15)`,
        opacity: 1,
        offset: 0.18, // Giữ nhịp đầu để người dùng dễ theo dõi
      },
      {
        transform: `translate(${midX}px, ${midY}px) scale(0.95)`,
        opacity: 1,
        offset: 0.58, // Vòng cung giữa màn hình
      },
      {
        transform: `translate(${deltaX}px, ${deltaY}px) scale(0.22)`,
        opacity: 0.2, // Thu nhỏ chui vào giỏ hàng
      },
    ];

    const anim = flyer.animate(keyframes, {
      duration,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'forwards',
    });

    anim.onfinish = () => {
      flyer.remove();

      // Hiệu ứng nảy (bounce) cho nút giỏ hàng và huy hiệu số lượng
      if (cartBtn) {
        cartBtn.classList.remove('cart-bounce');
        void (cartBtn as HTMLElement).offsetWidth;
        cartBtn.classList.add('cart-bounce');
        setTimeout(() => cartBtn.classList.remove('cart-bounce'), 550);

        const badge = cartBtn.querySelector('.xanhla-cart-badge');
        if (badge) {
          badge.classList.remove('cart-badge-pop');
          void (badge as HTMLElement).offsetWidth;
          badge.classList.add('cart-badge-pop');
          setTimeout(() => badge.classList.remove('cart-badge-pop'), 450);
        }
      }

      // Nhãn +1 bay lên từ icon giỏ hàng
      const plusOne = document.createElement('div');
      plusOne.textContent = '+1';
      Object.assign(plusOne.style, {
        position: 'fixed',
        zIndex: '9999999',
        left: `${endX + 6}px`,
        top: `${endY - 10}px`,
        color: '#15803d',
        fontWeight: '800',
        fontSize: '15px',
        fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
        textShadow: '0 1px 2px rgba(255,255,255,0.9)',
        pointerEvents: 'none',
        transition: 'all 0.6s ease-out',
        opacity: '1',
        transform: 'translateY(0)',
      });
      document.body.appendChild(plusOne);
      requestAnimationFrame(() => {
        plusOne.style.transform = 'translateY(-24px) scale(1.25)';
        plusOne.style.opacity = '0';
      });
      setTimeout(() => plusOne.remove(), 650);
    };
  } catch (err) {
    console.warn('Lỗi hiệu ứng bay giỏ hàng:', err);
  }
}
