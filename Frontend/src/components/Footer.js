// Функция для рендеринга футера
export function renderFooter() {
  return `
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-links">
          <a href="#" class="footer-link">О нас</a>
          <a href="#" class="footer-link">Функции</a>
          <a href="#" class="footer-link">Документация</a>
          <a href="#" class="footer-link">Контакты</a>
        </div>
        <div class="footer-copyright">
          © ${new Date().getFullYear()} ITConnect. Все права защищены.
        </div>
      </div>
    </footer>
  `;
} 