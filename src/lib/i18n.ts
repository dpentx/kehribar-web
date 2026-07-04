export type Lang = 'tr' | 'en';

export const translations = {
  tr: {
    'nav-home': 'Anasayfa',
    'nav-blog': 'Blog',
    'nav-nixzone': 'NixZONE',
    'nav-projects': 'Projeler',
    'nav-contributions': 'Katkılar',
    'nav-contact': 'İletişim',
    'stat-blogs': 'Blog Yazıları',
    'stat-repos': 'Repolar',
    'stat-stars': 'Yıldızlar',
    'loading': 'Yükleniyor...',
    'no-content': 'İçerik bulunamadı',
    'error': 'Bir hata oluştu',
    'bio-text':
      'NixOS ile ilgilenen ve çeviri yapan biriyim. Açık kaynak projelere katkı sağlamayı ve teknolojinin insanlara fayda sağlayacak şekilde kullanılmasını destekliyorum.',
    'contact-title': 'İletişim',
    'contact-subtitle': 'Benimle iletişime geçmek için aşağıdaki platformları kullanabilirsiniz',
    'contact-github-desc': 'Açık kaynak projelerim ve katkılarım',
    'contact-mal-desc': 'Anime izleme listem ve değerlendirmelerim',
    'contact-note-title': 'Açık kaynak katkıları',
    'contact-note-text':
      'Açık kaynak projelere katkı yapmaktan ve işbirliği yapmaktan mutluluk duyuyorum. GitHub üzerinden benimle iletişime geçebilir, projelerime katkı sağlayabilirsiniz.',
    'contributions-intro-title': 'Açık Kaynak Çeviri Katkıları',
    'contributions-intro-text': 'Açık kaynak ekosistemine İngilizceden Türkçeye çeviri katkıları yapıyorum.',
    'contribution-type-translation': '🌐 Türkçe Çeviri',
    'nixzone-sub': 'NixOS kurulum detayları, pirinçler ve konfigürasyon notları.',
    'nixzone-posts-title': 'YAZILAR',
    'nixzone-empty': 'Henüz yazı yok — yakında gelecek! ❄️',
    'blog-empty': 'Henüz blog yazısı yok — yakında gelecek! ✍️',
    'read-more': 'Devamını oku',
    'back': 'Geri',
  },
  en: {
    'nav-home': 'Home',
    'nav-blog': 'Blog',
    'nav-nixzone': 'NixZONE',
    'nav-projects': 'Projects',
    'nav-contributions': 'Contributions',
    'nav-contact': 'Contact',
    'stat-blogs': 'Blog Posts',
    'stat-repos': 'Repositories',
    'stat-stars': 'Stars',
    'loading': 'Loading...',
    'no-content': 'No content found',
    'error': 'An error occurred',
    'bio-text':
      "I'm interested in NixOS and translation work. I support contributing to open source projects and using technology to benefit people.",
    'contact-title': 'Contact',
    'contact-subtitle': 'You can reach me through the following platforms',
    'contact-github-desc': 'My open source projects and contributions',
    'contact-mal-desc': 'My anime watchlist and reviews',
    'contact-note-title': 'Open source contributions',
    'contact-note-text':
      "I'm happy to contribute to open source projects and collaborate. You can contact me via GitHub and contribute to my projects.",
    'contributions-intro-title': 'Open Source Translation Contributions',
    'contributions-intro-text': 'I contribute to the open-source ecosystem through English → Turkish translations.',
    'contribution-type-translation': '🌐 Turkish Translation',
    'nixzone-sub': 'NixOS setup details, rices, and configuration notes.',
    'nixzone-posts-title': 'POSTS',
    'nixzone-empty': 'No posts yet — coming soon! ❄️',
    'blog-empty': 'No blog posts yet — coming soon! ✍️',
    'read-more': 'Read more',
    'back': 'Back',
  },
} as const;

export type TranslationKey = keyof typeof translations.tr;

export function t(lang: Lang, key: TranslationKey): string {
  return translations[lang][key] ?? translations.tr[key];
}

export const NAV_ITEMS: Array<{ page: string; icon: string; key: TranslationKey; href: string }> = [
  { page: 'home', icon: 'house', key: 'nav-home', href: '/' },
  { page: 'blog', icon: 'folder', key: 'nav-blog', href: '/blog' },
  { page: 'nixzone', icon: 'snowflake', key: 'nav-nixzone', href: '/nixzone' },
  { page: 'projects', icon: 'code', key: 'nav-projects', href: '/projects' },
  { page: 'contributions', icon: 'language', key: 'nav-contributions', href: '/contributions' },
  { page: 'contact', icon: 'envelope', key: 'nav-contact', href: '/contact' },
];

// Static-site-safe i18n routing: language lives in the URL path (/en/...),
// never in a query string. Static HTML has no per-request server to read
// ?lang= at visit time, so a query param can never actually change what a
// visitor sees on a purely static host — this is the fix for that.
export function langPath(lang: Lang, path: string): string {
  if (lang !== 'en') return path;
  return path === '/' ? '/en' : `/en${path}`;
}

