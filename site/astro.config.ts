// @ts-check
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/config';

// https://astro.build/config
// site は canonical / sitemap（P4）で使用。URL はサイト設定（src/config.ts）に一元化。
export default defineConfig({
  site: SITE_URL,
  // 静的出力（デフォルト）。末尾スラッシュ付きURLで統一（内部リンクと一致させる）。
  trailingSlash: 'always',
  integrations: [
    // アイコン: Phosphor Icons（絵文字全廃・デザインガイドライン §5）
    icon(),
    // sitemap.xml を自動生成（仕様 §8）。robots.txt から参照する。
    sitemap(),
  ],
});
