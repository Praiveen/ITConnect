// Функция для рендеринга футера
export function renderFooter() {
  return `
    <footer class="footer">
      <div class="footer-content">

        <div class="footer-copyright">
          © ${new Date().getFullYear()} ITConnect. Все права защищены.
        </div>
      </div>
    </footer>
  `;
} 