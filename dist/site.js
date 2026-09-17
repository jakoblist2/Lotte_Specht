document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    if (!target) return;

    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      button.textContent = "Kopiert";
    } catch {
      button.textContent = "Bitte markieren";
    }

    window.setTimeout(() => {
      button.textContent = original;
    }, 1600);
  });
});
