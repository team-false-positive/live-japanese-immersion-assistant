# Style guide: Live Japanese Immersion Assistant

Week 9. Every screen in the extension follows this guide, so the app looks like one product.

## Palette (traditional Japanese colours)

| Name | Japanese | Hex | Use |
|---|---|---|---|
| Indigo | 藍 ai | #2E3A87 | Primary buttons, headings, progress fill |
| Indigo soft | | #E8EBF7 | Hover backgrounds, progress track |
| Vermillion | 朱 shu | #E34B2F | Wrong answers, streaks, warnings |
| Vermillion soft | | #FDE9E4 | Wrong-answer background |
| Matcha green | 抹茶 | #3B7D4F | Correct answers |
| Matcha soft | | #E3F2E7 | Correct-answer background |
| Washi | 和紙 | #F7F3E8 | Page background (cream paper) |
| Ink | 墨 sumi | #1F1F24 | Body text |
| Muted | | #6B6B73 | Secondary text, hints |
| Line | | #E2DCCD | Borders and dividers |

Colour is never the only signal. A correct or wrong answer also gets a word ("Correct." / "Not quite.").

## Type

- **English text:** Segoe UI, with Helvetica Neue and Arial as fallbacks.
- **Japanese text:** Yu Gothic UI, then Meiryo, Hiragino Sans, and Noto Sans JP.
- **Sizes:** headings 22 px; body 16 px; hints 14 px; large prompt (the word being studied) 40 to 48 px.
- Japanese text is set in the Japanese font, using the `ja` class.

## Shape

- Cards: 12 px corners, one soft shadow, white on washi.
- Buttons and answer choices: 8 px corners.
- Progress bars and badges: fully rounded (pill shape).
- No icon set yet. Use text labels, not icons.
- No mascot.

## Motion

- Hover and press: 200 ms, colour change and a slight press (scale 0.98).
- Correct answer: a short "pop" (300 ms).
- Wrong answer: a short shake (260 ms).
- Progress bars fill over 400 ms.
- Everything is switched off when the system asks for reduced motion.

## Subtitle overlay (special case)

The overlay sits on top of someone else's video, so it has stricter rules:
- Semi-transparent dark background, never fully opaque.
- Text no larger than 22 px.
- Stays out of the centre of the picture, near the bottom.
- Never blocks clicks on the video controls.
- Never animates, so it doesn't pull the eye from the video.

## Shared components

All pages load `extension/ui/theme.css`. Use its classes instead of writing new styles:
`.card`, `.btn`, `.btn-primary`, `.choice` (with `.right` and `.wrong`), `.progress-bar` and `.progress-fill`, `.badge`, `.streak`, `.feedback-correct`, `.feedback-wrong`, `.pop`, `.shake`, and `.ja`.
