/* ============================================================
   Product catalog — single source of truth for the product
   detail page (product.html). Every product card across the
   site links to product.html?id=<id>, and product.js reads this
   file to render the correct name/price/images/specs for that id.
   ============================================================ */

const CATEGORY_LABELS = {
  phone: 'گوشی موبایل',
  speaker: 'باند و اسپیکر',
  modem: 'مودم و روتر',
  accessory: 'لوازم جانبی'
};

const PRODUCT_CATALOG = {

  s24ultra: {
    name: 'گوشی سامسونگ Galaxy S24 Ultra',
    brand: 'سامسونگ',
    category: 'phone',
    image: 'images/s24ultra.png',
    thumbClass: 't-teal',
    thumbs: [
      ['images/s24ultra.png', 'نمای جلو'],
      ['images/s25.25.png', 'قاب و کاور'],
      ['images/galaxy-s24-ultra-3.png', 'آداپتور همراه'],
      ['images/galaxy-s24-ultra-2.png', 'کابل شارژ همراه']
    ],
    price: 68500000,
    oldPrice: 73500000,
    ratingStars: 5,
    reviewCount: '۹۸',
    soldText: '۴۲۰+ فروش',
    specLine: 'قلم S Pen · دوربین ۲۰۰ مگاپیکسل',
    warrantyMonths: 18,
    colors: ['مشکی تیتانیوم', 'بنفش تیتانیوم', 'خاکستری تیتانیوم'],
    storages: ['۲۵۶ گیگابایت', '۵۱۲ گیگابایت', '۱ ترابایت'],
    longDesc: 'گوشی سامسونگ Galaxy S24 Ultra با صفحه‌نمایش Dynamic AMOLED 2X، دوربین اصلی ۲۰۰ مگاپیکسل و قلم S Pen داخلی تجربه‌ای حرفه‌ای در عکاسی و کارایی روزمره ارائه می‌دهد. قلم S Pen به‌صورت داخلی در بدنه دستگاه جای می‌گیرد.',
    features: [
      'صفحه‌نمایش Dynamic AMOLED 2X با نرخ ۱۲۰ هرتز',
      'دوربین اصلی ۲۰۰ مگاپیکسل با زوم اپتیکال',
      'قلم S Pen داخلی برای یادداشت و طراحی',
      'بدنه تیتانیوم مقاوم در برابر آب و گرد‌و‌غبار (IP68)',
      '۱۸ ماه گارانتی شرکتی'
    ],
    specs: [
      ['برند', 'سامسونگ (Samsung)'],
      ['مدل', 'Galaxy S24 Ultra'],
      ['صفحه‌نمایش', '۶.۸ اینچ Dynamic AMOLED 2X'],
      ['پردازنده', 'Snapdragon 8 Gen 3 for Galaxy'],
      ['حافظه رم', '۱۲ گیگابایت'],
      ['حافظه داخلی', '۲۵۶ گیگابایت'],
      ['دوربین اصلی', '۲۰۰ مگاپیکسل + دوربین‌های تله‌فوتو و اولترا واید'],
      ['باتری', '۵۰۰۰ میلی‌آمپرساعت'],
      ['گارانتی', '۱۸ ماه شرکتی'],
      ['کد فنی', 'MGX-S24U-256']
    ]
  },

  iphone13: {
    name: 'گوشی اپل iPhone 13', brand: 'اپل', category: 'phone',
    image: 'images/apple_iphone_13-pn.png', thumbClass: 't-amber',
        thumbs: [
      ['images/apple_iphone_13-pn.png', 'نمای جلو'],
      ['images/apple_iphone_13-66326.png', 'قاب و کاور'],
      ['images/apple_iphone_13.png', 'آداپتور همراه'],
      ['images/1711279.png', 'کابل شارژ همراه']
    ],
    price: 27900000, oldPrice: 30500000,
    ratingStars: 4, reviewCount: '۱۲۰', specLine: 'تراشه A15 Bionic',
    colors: ['مشکی', 'سفید', 'آبی', 'صورتی'], storages: ['۱۲۸ گیگابایت', '۲۵۶ گیگابایت']
  },

  iphone15pro: {
    name: 'گوشی اپل iPhone 15 Pro', brand: 'اپل', category: 'phone',
    image: 'images/phone.svg', thumbClass: 't-violet',
    price: 62000000,
    ratingStars: 5, reviewCount: '۵۴', specLine: 'بدنه تیتانیوم · دوربین حرفه‌ای',
    colors: ['تیتانیوم مشکی', 'تیتانیوم طبیعی', 'تیتانیوم آبی'], storages: ['۲۵۶ گیگابایت', '۵۱۲ گیگابایت']
  },

  a34: {
    name: 'گوشی سامسونگ Galaxy A34 5G', brand: 'سامسونگ', category: 'phone',
    image: 'images/phone.svg', thumbClass: 't-teal',
    price: 14200000,
    ratingStars: 4, reviewCount: '۲۲', specLine: 'صفحه Super AMOLED ۶.۶ اینچ',
    colors: ['مشکی', 'نقره‌ای', 'بنفش'], storages: ['۱۲۸ گیگابایت', '۲۵۶ گیگابایت']
  },

  pocox6: {
    name: 'گوشی شیائومی POCO X6 5G', brand: 'شیائومی', category: 'phone',
    image: 'images/phone.svg', thumbClass: 't-amber',
    price: 13400000,
    ratingStars: 5, reviewCount: '۷۱', specLine: 'شارژ سریع ۶۷ وات',
    colors: ['مشکی', 'آبی', 'زرد'], storages: ['۲۵۶ گیگابایت']
  },

  redmi13c: {
    name: 'گوشی شیائومی Redmi 13C', brand: 'شیائومی', category: 'phone',
    image: 'images/phone.svg', thumbClass: 't-violet',
    price: 7200000,
    ratingStars: 4, reviewCount: '۳۳', specLine: 'باتری ۵۰۰۰ میلی‌آمپر',
    colors: ['مشکی', 'سبز', 'نقره‌ای'], storages: ['۱۲۸ گیگابایت']
  },

  a55: {
    name: 'گوشی سامسونگ Galaxy A55 5G', brand: 'سامسونگ', category: 'phone',
    image: 'images/phone.svg', thumbClass: 't-teal',
    price: 14200000, oldPrice: 16500000,
    ratingStars: 5, reviewCount: '۲۱۴', specLine: 'دوربین ۵۰ مگاپیکسل · گارانتی ۱۸ ماهه',
    colors: ['مشکی', 'آبی روشن', 'لیمویی'], storages: ['۱۲۸ گیگابایت', '۲۵۶ گیگابایت']
  },

  'redmi-note13': {
    name: 'گوشی شیائومی Redmi Note 13', brand: 'شیائومی', category: 'phone',
    image: 'images/phone.svg', thumbClass: 't-violet',
    price: 9850000, oldPrice: 10900000,
    ratingStars: 5, reviewCount: '۶۷', specLine: 'صفحه AMOLED · شارژ سریع ۳۳ وات',
    colors: ['مشکی', 'سبز', 'طلایی'], storages: ['۱۲۸ گیگابایت', '۲۵۶ گیگابایت']
  },

  'speaker-rgb': {
    name: 'باند رومیزی بلوتوثی با نور RGB', category: 'speaker',
    image: 'images/speaker.svg', thumbClass: 't-teal',
    price: 1250000, oldPrice: 1420000,
    ratingStars: 5, reviewCount: '۲۶۰', specLine: 'صدای بیس‌دار · اتصال بلوتوث ۵.۳'
  },

  'speaker-mini': {
    name: 'باند بلوتوثی مینی جیبی', category: 'speaker',
    image: 'images/speaker.svg', thumbClass: 't-amber',
    price: 690000,
    ratingStars: 5, reviewCount: '۱۸۹', specLine: 'قابل حمل · مناسب سفر'
  },

  'speaker-waterproof': {
    name: 'باند بلوتوثی قابل حمل ضدآب', category: 'speaker',
    image: 'images/speaker.svg', thumbClass: 't-amber',
    price: 790000, oldPrice: 980000,
    ratingStars: 4, reviewCount: '۱۵۸', specLine: 'صدای استریو · باتری ۱۲ ساعته'
  },

  'router-ac1200': {
    name: 'روتر Wi-Fi خانگی دو‌باند AC1200', category: 'modem',
    image: 'images/modem.svg', thumbClass: 't-violet',
    price: 1450000,
    ratingStars: 4, reviewCount: '۹۴', specLine: 'پوشش تا ۲۰۰ متر مربع'
  },

  'modem-4g-desk': {
    name: 'مودم 4G رومیزی سیم‌کارت‌خور', category: 'modem',
    image: 'images/modem.svg', thumbClass: 't-teal',
    price: 2100000,
    ratingStars: 5, reviewCount: '۳۴۱', specLine: 'پشتیبانی از همه اپراتورها'
  },

  'modem-4g-portable': {
    name: 'مودم 4G قابل حمل همراه', category: 'modem',
    image: 'images/modem.svg', thumbClass: 't-teal',
    price: 2100000,
    ratingStars: 4, reviewCount: '۳۹', specLine: 'پشتیبانی ۱۰ کاربر همزمان'
  },

  'cable-typec-65w': {
    name: 'کابل شارژ فست شارژ تایپ سی ۶۵ وات', category: 'accessory', accType: 'cable',
    image: 'images/cable.svg', thumbClass: 't-amber',
    price: 198000,
    ratingStars: 4, reviewCount: '۱۱۰', specLine: 'طول ۱.۲ متر'
  },

  'charger-33w': {
    name: 'آداپتور شارژر دیواری ۳۳ وات فست شارژ', category: 'accessory', accType: 'charger',
    image: 'images/charger.svg', thumbClass: 't-violet',
    price: 210000,
    ratingStars: 5, reviewCount: '۴۸', specLine: 'سازگار با اکثر برندها'
  },

  'charger-45w': {
    name: 'آداپتور شارژر دیواری ۴۵ وات فست شارژ', category: 'accessory', accType: 'charger',
    image: 'images/charger.svg', thumbClass: 't-violet',
    price: 340000, oldPrice: 390000,
    ratingStars: 5, reviewCount: '۱۶۲', specLine: 'سازگار با شارژ سریع سامسونگ'
  },

  'earphone-wireless': {
    name: 'هندزفری بی‌سیم بلوتوثی', category: 'accessory', accType: 'earphone',
    image: 'images/earphone.svg', thumbClass: 't-amber',
    price: 690000, oldPrice: 770000,
    ratingStars: 5, reviewCount: '۴۰۲', specLine: 'حذف نویز محیط'
  },

  'case-s24u': {
    name: 'قاب محافظ ضدضربه Galaxy S24 Ultra', category: 'accessory', accType: 'case',
    image: 'images/case.svg', thumbClass: 't-amber',
    price: 299000, oldPrice: 340000,
    ratingStars: 5, reviewCount: '۲۰۵', specLine: 'جذب ضربه · دور دوربین محافظ'
  }

};

if (typeof module !== 'undefined') module.exports = { PRODUCT_CATALOG, CATEGORY_LABELS };
