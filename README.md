# Lookit Media Master

[![License](https://img.shields.io/badge/license-GPLv2-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)
[![Lint](https://github.com/Lookit-Design/media-master/actions/workflows/lint.yml/badge.svg)](../../actions/workflows/lint.yml)
[![Coding Standards](https://github.com/Lookit-Design/media-master/actions/workflows/coding-standards.yml/badge.svg)](../../actions/workflows/coding-standards.yml)
[![Plugin Check](https://github.com/Lookit-Design/media-master/actions/workflows/plugin-check.yml/badge.svg)](../../actions/workflows/plugin-check.yml)
[![Tests](https://github.com/Lookit-Design/media-master/actions/workflows/test.yml/badge.svg)](../../actions/workflows/test.yml)

A unified WordPress media toolkit for resizing, importing, protected ZIP export, and managing attachment metadata.

Supports `WordPress >= 5.9` on `PHP >= 7.4`.

## Table of Contents

- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Features](#features)
- [Security and Privacy](#security-and-privacy)
- [Development](#development)
  - [Setup](#setup)
  - [Running the Test Suite](#running-the-test-suite)
  - [Coding Standards](#coding-standards)
  - [Continuous Integration](#continuous-integration)
- [Contributing](#contributing)
- [License](#license)

## Getting Started

### Installation

This plugin is installed from GitHub, not from WordPress.org.

1. Clone or copy this repository into `/wp-content/plugins/lookit-media-master`.
2. Activate **Lookit Media Master** through the **Plugins** menu in WordPress.

### Configuration

1. Open **Media Master → Settings**.
2. Set the Lookit AI endpoint URL if you want AI-generated alt text, titles, captions, and descriptions.
3. Optionally paste the endpoint token. The field stays blank after save; leave it empty to keep the stored value.

AI features only run when an endpoint is configured and you trigger a generate action.

## Features

* **Image Resizer & Compressor** — resize and compress images in the browser before they enter the Media Library.
* **Media Library Resizer** — fit images inside width and height boxes without upscaling, with an optional one-time backup of each original.
* **All Tasks** — start from a single work overview with links and outstanding metadata counts.
* **Metadata Manager** — find missing alt text, captions, or descriptions, then edit fields or generate selected fields in bulk.
* **Title Manager** — bulk-edit attachment titles, title from filenames, or generate titles from the image.
* **Attachment pages** — preview individual files, edit all metadata fields, and navigate between accessible images.
* **Generation context** — supply temporary factual context for caption or description generation without saving it to the attachment.
* **Attachment metabox** — generate metadata into the native WordPress fields without saving until Update is pressed.
* **Import** — upload supported media one file per request, with optional client-side image optimization.
* **Export** — build filtered ZIP archives in batches and download them through authenticated handlers.
* **Optional Media menu absorption** — place core and third-party Media submenus under Media Master, off by default.
* **Large-library grids** — page queries, cache aggregate title statistics, load appropriately sized thumbnails, and defer usage counts until cards render.
* **Usage indicators** — see how many posts embed each image, and jump to those posts from the card.

## Security and Privacy

* The optional endpoint token is **never** rendered back into the settings form. Submitting the field blank keeps the saved value.
* The token option is **not autoloaded**, so it is not pulled into memory on every front-end request.
* Export archives use randomized directories, contain only files the requester may edit, and are served solely to the user who created them.
* Export archives are deleted automatically after seven days.
* On uninstall, stored settings including the token are **removed from the database**.

When you run an AI generate action, the plugin sends the selected image, your prompt, and the site URL and name to the Lookit AI endpoint you configured. No data is sent until you trigger that action.

See Lookit AI [terms](https://lookitai.com/terms) and [privacy](https://lookitai.com/privacy).

The deployable n8n workflow and production setup instructions are in [`n8n/`](n8n/).

## Development

### Setup

Install the development dependencies with [Composer](https://getcomposer.org/):

```bash
composer install
```

### Running the Test Suite

The integration tests run against a real WordPress test install and a MySQL database. Install the test suite once, then run PHPUnit:

```bash
# bin/install-wp-tests.sh <db-name> <db-user> <db-pass> <db-host> <wp-version>
bin/install-wp-tests.sh wordpress_test root '' 127.0.0.1 latest

composer test
node --test 'n8n/tests/*.test.mjs'
```

### Coding Standards

This project follows the WordPress Coding Standards and checks PHP cross-version compatibility:

```bash
composer phpcs    # check coding standards
composer phpcbf   # auto-fix what can be fixed
composer compat   # check PHP 7.4+ compatibility
composer lint     # php -l syntax check on all files
```

### Continuous Integration

Every push and pull request runs the following GitHub Actions workflows:

| Workflow | Purpose |
| --- | --- |
| [Lint](../../actions/workflows/lint.yml) | `php -l` syntax check across the supported PHP versions |
| [Coding Standards](../../actions/workflows/coding-standards.yml) | WordPress Coding Standards (PHPCS) |
| [Plugin Check](../../actions/workflows/plugin-check.yml) | Official WordPress Plugin Check |
| [Test](../../actions/workflows/test.yml) | PHPUnit across a broad WordPress × PHP matrix |

A scheduled [Version Monitor](../../actions/workflows/version-monitor.yml) workflow watches for new PHP and WordPress releases so compatibility can be reviewed proactively.

## Contributing

Bug reports and pull requests are welcome on [GitHub](../../issues).

## License

This plugin is available as open source under the terms of the [GPL-2.0-or-later License](https://www.gnu.org/licenses/gpl-2.0.html).

---

_Lookit&reg; is a registered trademark of ZENOVA CORP._
