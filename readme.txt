=== Lookit Media Master ===
Contributors: lookitdesign
Tags: media, images, alt text, compress, resize
Requires at least: 5.9
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 3.42.5
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A unified media toolkit: image resizer and compressor, media library resizer, AI-powered alt text and title management, and bulk export to ZIP.

== Description ==

Lookit Media Master brings several media-handling tools together under one admin screen:

* **Image Resizer & Compressor** — resize and compress images in the browser before uploading them to the Media Library.
* **Media Library Resizer** — re-process images that are already in the Media Library, with an optional one-time backup of each original.
* **Metadata Manager** — review images that are missing alt text, captions or descriptions, edit any of them manually, or generate them from the image using a vision-capable AI model (AWS Bedrock, via the Lookit AI platform). Includes bulk alt text from post titles and select-all controls.
* **Attachment pages** — every image has its own screen in the plugin, addressable by post ID, with a preview, file details, all four metadata fields and per-field AI generation.
* **Media Master metabox** — on the WordPress attachment edit screen, generate alt text, a caption or a description straight into the fields already on that page.
* **Import** — upload images, video, audio, PDFs, Office documents and archives into the Media Library from one screen. Images are resized and compressed in your browser before upload; everything else is stored as-is.
* **Export** — download the Media Library, or any filtered slice of it, as a ZIP. Filter by media type, date range, attachment status or filename; choose how the archive is foldered (including grouping by the page or post each file was uploaded to); optionally include a metadata CSV listing alt text, caption and uploaded-to page for every file. Large libraries are packaged in batches and can be split into several archives.
* **Title Manager** — bulk-edit attachment titles, auto-title from filenames, or AI-generate titles from the image. Detects WordPress's default filename-based titles so they can be found and replaced.

AI features are optional and only run when you set your Lookit AI endpoint in Settings.

== External Services ==

This plugin connects to the Lookit AI platform (a self-hosted n8n endpoint operated by Lookit Design) to power its optional AI features (generating alt text, captions, descriptions and titles from images). When you use an AI generation feature, the plugin sends the relevant image (as a base64-encoded data URI), your configured text prompt, and your site URL and name to the endpoint you configure. The platform calls AWS Bedrock to analyse the image and returns the generated text. No data is sent unless you configure an endpoint and trigger an AI generation action.

* Service: Lookit AI platform (https://lookitai.com)
* Data sent: the selected image, your text prompt, and your site URL and name
* When: only when you click an AI generation action for alt text, titles, captions or descriptions
* Terms of Service: https://lookitai.com/terms
* Privacy Policy: https://lookitai.com/privacy

The plugin also bundles a local copy of the JSZip library (MIT licensed) for building ZIP downloads in the browser; no external request is made for it.

== Changelog ==

= 3.42.5 =
* Fixed: a Plugin Check warning. The Changelog section had grown past WordPress.org's 5,000-character limit and was being truncated. The recent releases stay here; the full history moved to changelog.txt.

= 3.42.4 =
* Fixed: the new logo did not appear after updating. The logo was the one asset served without a version query, so browsers kept the old artwork even though the file on disk had changed. It now ships under a new filename with a version query, like every other asset.

= 3.42.3 =
* Fixed: soft thumbnails in the card grids. Every grid asked WordPress for the 300px size, chosen back when cards rendered at 200px; with the larger cards that file was being scaled up. All three grids now pull the 768px size, through one shared helper, with a fallback chain for images that never had one generated.
* Changed: new Lookit mark as the plugin logo, running edge to edge in a round frame.

= 3.42.2 =
* Fixed: the card rows themselves, rather than only the slider. The alt textarea can now shrink, so Save cannot ride over it, and Generate / Edit details stack rather than overlapping when they will not fit side by side. Narrow cards degrade instead of breaking.
* Changed: the size slider floor is now the seven-across size, and the top end goes a step further for anyone who wants larger thumbnails.
* Changed: **AI writes** starts with Alt ticked only. Caption and Description are opt-in, so a bulk run is one platform call per image unless you ask for more.
* Changed: **AI Generate (Selected)** sits between Use Title as Alt and Save, and the toolbar's search box gives up width first so all three buttons stay on one line.

= 3.42.1 =
* Fixed: the big counts on the All tasks screen rendered near-black on the dark theme. The stat tiles became buttons in 3.36.0, and a button does not inherit text colour from its container, so the browser's own colour was winning.
* Changed: the card size slider now stops at the 7-across size instead of going smaller. Below that the Generate and Edit details buttons overlapped. A saved size under the new floor is lifted to it.

= 3.42.0 =
* Added: **Caption** gets its own Extra context box, matching Description. Each field has its own box and reads only its own, so a caption credit and a longer description note can differ.
* Caption's instruction is length-aware: the caption stays inside its one-sentence limit, and where everything will not fit the supplied facts are kept and the visual description is trimmed.
* Both boxes still do nothing when empty, are never saved to the attachment, and are unavailable on the bulk screens.

= 3.41.1 =
* Fixed: Extra context that reads as an attribution ("Logo by Ricky") was being dropped from the generated description. The instruction sent with it asked the model not to restate context as a credit line, which it took literally. Every fact you type is now required to appear in the description, credits included.
* The status line under the buttons now says when a generation used your extra context, so a plain-looking result is easy to tell apart from context that never arrived.

= 3.41.0 =
* Added: An **Extra context** box inside the Description field on the single attachment page. Type anything the AI cannot see in the image — photographer, event, location, product name — and Description's Generate treats it as fact and works it into the copy.
* It sits under the Description box as part of the same field, so it is clear the two belong together. Description only, on this screen only. Bulk screens are unchanged.
* Leave it empty and Generate behaves exactly as it did before. The box is never saved to the attachment; it applies to the generation you are about to run.

= 3.40.0 =
* Added: AI Generate (Selected) on the Alt text & captions screen now writes the caption and description as well as the alt text.
* Added: An "AI writes" field picker next to Overwrite existing, so a run can be limited to just the fields you want.
* Changed: Fields that already have content are skipped individually rather than skipping the whole image, so a second run fills only the gaps.

= 3.39.3 =
* Changed: Internal rework of how the image grids fetch and display usage counts. No change to what you see.

Older entries are in changelog.txt, alongside the plugin file. WordPress.org caps this section at 5,000 characters, so only the recent releases are listed here.
