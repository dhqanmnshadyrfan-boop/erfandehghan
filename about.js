// About/Support/FAQ/Terms page: smooth scroll to the right section, whether the
// person clicked a sidebar link on this page or arrived from a footer link
// elsewhere (e.g. index.html -> about.html#faq).

function setActiveMenuLink(hash){
  document.querySelectorAll('.account-menu a').forEach(a => a.classList.remove('active'));
  try{
    const link = document.querySelector(`.account-menu a[href="${hash}"]`);
    if (link) link.classList.add('active');
  }catch(e){ /* malformed hash from a crafted link — nothing to activate */ }
}

function scrollToHash(hash){
  if (!hash) return;
  let target;
  try{ target = document.querySelector(hash); }
  catch(e){ return; } // location.hash isn't guaranteed to be a valid CSS selector
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setActiveMenuLink(hash);
}

// Arrived from another page with a hash (e.g. footer "پشتیبانی" -> about.html#support)
document.addEventListener('DOMContentLoaded', () => {
  if (location.hash){
    // small delay so layout/fonts settle before measuring scroll position
    setTimeout(() => scrollToHash(location.hash), 60);
  }
});

// In-page sidebar navigation
document.querySelectorAll('.account-menu a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const hash = link.getAttribute('href');
    scrollToHash(hash);
    history.replaceState(null, '', hash);
  });
});
