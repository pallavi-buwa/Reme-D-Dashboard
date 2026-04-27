import { useLanguage } from '../context/LanguageContext'

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage()
  const isAr = lang === 'ar'

  return (
    <button
      onClick={() => setLang(isAr ? 'en' : 'ar')}
      title={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
      className="flex items-center gap-1 px-2.5 py-1 rounded border border-gray-200 text-xs font-medium text-gray-600 hover:border-remed-red hover:text-remed-red transition-colors bg-white select-none"
      style={{ fontFamily: isAr ? 'inherit' : 'inherit', letterSpacing: 0 }}
    >
      <span className="text-base leading-none">{isAr ? '🇬🇧' : '🇪🇬'}</span>
      <span>{isAr ? 'EN' : 'عربي'}</span>
    </button>
  )
}
