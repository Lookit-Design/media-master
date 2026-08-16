=== Lookit Media Master ===
Contributors: lookitdesign
Tags: media, images, alt text, compress, resize
Requires at least: 5.9
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 3.16.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A unified media toolkit: image resizer and compressor, media library resizer, and AI-powered alt text and title management.

== Description ==

Lookit Media Master brings several media-handling tools together under one admin screen:

* **Image Resizer & Compressor** — resize and compress images in the browser before uploading them to the Media Library.
* **Media Library Resizer** — re-process images that are already in the Media Library, with an optional one-time backup of each original.
* **Alt Text Manager** — review images that are missing alt text, edit alt text manually, or generate it automatically from the image using a vision-capable AI model (AWS Bedrock, via the Lookit AI platform). Includes bulk alt text from post titles and select-all controls.
* **Title Manager** — bulk-edit attachment titles, auto-title from filenames, or AI-generate titles from the image. Detects WordPress's default filename-based titles so they can be found and replaced.

AI features are optional and only run when you set your Lookit AI endpoint in Settings.

== External Services ==

This plugin connects to the Lookit AI platform (a self-hosted n8n endpoint operated by Lookit Design) to power its optional AI features (generating alt text and titles from images). When you use an AI generation feature, the plugin sends the relevant image (as a base64-encoded data URI), your configured text prompt, and your site URL and name to the endpoint you configure. The platform calls AWS Bedrock to analyse the image and returns the generated text. No data is sent unless you configure an endpoint and trigger an AI generation action.

* Service: Lookit AI platform (https://lookitai.com)
* Data sent: the selected image, your text prompt, and your site URL and name
* When: only when you click an "AI generate" action for alt text or titles
* Terms of Service: https://lookitai.com/terms
* Privacy Policy: https://lookitai.com/privacy

The plugin also bundles a local copy of the JSZip library (MIT licensed) for building ZIP downloads in the browser; no external request is made for it.

== Changelog ==

= 3.16.2 =
* Require permission to edit each attachment before saving alt text, titles, or resized files, so authors cannot change another author's media.
* Validate resized image bytes before writing them, and accept only image uploads in the Image Resizer.

= 3.16.1 =
* Enlarged the "Used in" usage popup and bumped its text sizes for easier reading.

= 3.16.0 =
* Added a 2560px "Max" preset to the Image Resizer.
* Saved custom sizes: name and save your own resize presets (e.g. "Blog hero" · 1600px). Saved sizes appear as selectable options, can be reordered by dragging the handle, and removed individually. Stored per browser.

= 3.15.0 =
* Image Resizer now offers WebP conversion. In the resize Options, set "Output" to "Convert to WebP (adds a new copy)". Each selected image is resized (never upscaled) and saved as a brand-new .webp attachment in the media library, with alt text copied over. Originals are left untouched, so existing URLs never break. Leave "Output" on "Keep original format" for the usual in-place resize.

= 3.14.1 =
* Resolved two Plugin Check warnings on the usage-list handler (input sanitisation) by matching the codebase's `intval()` pattern. Plugin Check is clean again.

= 3.14.0 =
* Added a "Square Corners" toggle in the top bar (next to Dark Mode) for people who prefer sharp edges over the default rounded corners. The preference is remembered per browser. Circular elements like status dots stay round.

= 3.13.1 =
* Fixed the "Used in" usage popup rendering transparent/unreadable — it now mounts inside the plugin theme so it displays correctly in both light and dark mode.
* Renamed the Alt Text Manager suggestion label from "Claude suggests" to "Lookit suggests".

= 3.13.0 =
* Clickable "Used in N" chip: opens a popup listing every post and page that embeds the image, each with View and Edit links.
* Clickable stat cards: click "Have Alt Text" / "Missing Alt Text" (Alt Manager) or "Custom Titles" / "Auto Titles" (Title Manager) to instantly filter the grid to just those images. New "Have alt only" and "Custom titles only" filter options added to match.
* Resize savings estimate redesigned: now shows the projected saving at the chosen size (e.g. "↓ Save ~300 KB at 1200px") in a clearer, higher-contrast style, instead of a raw before/after byte readout.

= 3.12.0 =
* "Used in N posts" indicator on every image: shows how many posts/pages embed each image (inserted images and featured images), so you can prioritise images that actually appear on the site. Images not used anywhere are marked "Unused".
* Cross-tab "needs attention" chips: every card now shows at-a-glance warnings for missing alt text and auto (filename) titles, plus the usage count — the whole tool reads as one worklist regardless of which tab you're on.
* Resize savings preview: each Image Resizer card shows the projected result (e.g. "2560px → 1200px · ~498 KB → ~110 KB"), and a running total next to "Resize Selected" estimates how much the current selection will save. Estimates are approximate.
* One-click filter chips: "Select missing alt (N)" on the Alt Text Manager and "Select auto titles (N)" on the Title Manager instantly select all matching loaded images and jump to the first, so you can backfill with one more click.

= 3.11.1 =
* Title Manager: "AI Generate (Selected)" now regenerates titles for every selected image, including images that already have a custom title (explicit selection is treated as intent to rewrite). The "Overwrite custom titles" checkbox still governs the "Auto-Title from Filename" action.
* Sharper thumbnails: manager cards now use the 768px image size instead of the 150px thumbnail, so previews no longer look soft when scaled up in the grid.
* Image Resizer now loads the media library automatically on page load — no need to click "Load Images" after every refresh. The button still works as a manual reload.
* The "This overwrites files on your server" banner on the Image Resizer can now be dismissed (it stays hidden across refreshes). The same warning is shown permanently on the Settings page as a reminder.

= 3.11.0 =
* AI alt text and titles now run through the Lookit AI platform (self-hosted n8n → AWS Bedrock, Nova Lite vision) instead of OpenRouter. The plugin is now a thin client: no AI provider key is stored in WordPress. Settings replace the OpenRouter API key and model picker with a Lookit AI endpoint URL and an optional endpoint token. Model choice and metering live on the platform. Option keys, class names, nonces, AJAX action names, and DOM IDs are unchanged; existing installs keep their saved prompts.
* Settings: added a "Test Connection" button that sends a small built-in image to the configured endpoint and reports the round-trip time and reply — no media library needed.
* Alt Text Manager and Title Manager: added a "Save (Selected)" button that saves the current field for every selected image in one action, so multi-row edits no longer need a per-row Save click.

= 3.10.3 =
* Extended the Sort (Newest / Oldest / Filename A-Z / Filename Z-A) and Type (All / JPG / PNG / WebP) controls to the Alt Text Manager and Title Manager tabs, matching the Image Resizer. The alt and title batch endpoints now accept sort/type parameters.

= 3.10.2 =
* Image Resizer: added Sort (Newest, Oldest, Filename A-Z, Filename Z-A) and Type (All / JPG / PNG / WebP) controls to the media-library view. Filename sorting uses the stored file path; the type filter narrows the grid to a single format. Reuses the existing get-images endpoint with new sort/type parameters.

= 3.10.1 =
* Media Library Resize: the "Restore Original" button now appears on any image that still has a backup on disk, so the restore option persists after you leave and return to the plugin (previously it only showed in the session that performed the resize).

= 3.10.0 =
* Combined the Image Resizer and Media Library Resizer into a single "Image Resizer" tab: the browse-and-resize library grid is the default view, with an "Upload Images" button that swaps in the upload & compress panel (and a "Back to Library" control to return).
* Added per-tab view controls across the Image Resizer, Alt Text Manager, and Title Manager tabs: a grid/list view toggle, a display-size slider (scales thumbnail/card size), and a "Show N per page" selector (30 / 60 / 100 / All) with a "Load More" button for large libraries. View mode and size preferences persist per tab. The three batch AJAX endpoints now accept a per_page parameter. No option keys, AJAX action names, or nonces changed.

= 3.9.7 =
* Plugin Check compliance pass: fixed the plugin Version header to a valid version string, added a readme.txt with an External Services disclosure for the OpenRouter API, bundled the JSZip library locally instead of loading it from a CDN, replaced unlink() with wp_delete_file(), added wp_unslash()/sanitization to all form and AJAX input, and annotated intentional attachment meta_query filtering. No option keys, AJAX action names, or behaviour changed.

= 3.9.6 =
* Image Resizer: added "Upload to Media Library" button.

= 3.9.3 =
* New Title Manager tab: edit titles manually or AI-generate from the image, same flow as the Alt Manager. Detects auto titles (post_title == filename) so default filename-based titles can be found and replaced. Removed the "Bulk Title Fix" button from the Alt Manager.

= 3.9.2 =
* Refreshed the free vision model list and improved the reasoning-model response parser (handles a `reasoning` field and stray think blocks).

= 3.9.1 =
* Added Llama 4 models and fixed empty-response parsing.

= 3.9.0 =
* Fixed free model IDs and routing.
