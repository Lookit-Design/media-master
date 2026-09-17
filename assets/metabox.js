/* ══════════════════════════════════════════════════════════════════
   Lookit Media Master — attachment edit screen metabox
   v3.21.0

   Writes AI-generated text into the fields WordPress already renders on
   this screen, rather than into a duplicate set of inputs. Saving is left
   to the normal Update button, so nothing is written to the database here.
   ══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var box = document.getElementById('lmtbox');
  if (!box || typeof window.LMT_BOX === 'undefined') return;

  var id     = parseInt(box.dataset.id, 10);
  var status = document.getElementById('lmtbox-status');

  /* Core field IDs on post.php for an attachment:
       alt         → #attachment_alt      (input,    name="_wp_attachment_image_alt")
       caption     → #attachment_caption  (textarea, name="excerpt")
       description → #attachment_content  (textarea, name="content")

     The description one is the trap. Core builds it with
     wp_editor( $post->post_content, 'attachment_content', [ 'textarea_name' => 'content' ] )
     so the element ID is `attachment_content` while the POST key is
     `content`. Targeting #content silently matched nothing and the field
     never filled. Each entry is a list so an ID change, or a plugin that
     swaps the editor, degrades to the next candidate instead of breaking. */
  var TARGETS = {
    alt:         ['#attachment_alt', 'input[name="_wp_attachment_image_alt"]'],
    caption:     ['#attachment_caption', 'textarea[name="excerpt"]'],
    description: ['#attachment_content', '#content', 'textarea[name="content"]']
  };

  function say(msg, tone) {
    if (!status) return;
    status.textContent = msg;
    status.className = 'lmtbox-status' + (tone ? ' is-' + tone : '');
  }

  /** First matching element for a field, or null. */
  function fieldEl(field) {
    var list = TARGETS[field] || [];
    for (var i = 0; i < list.length; i++) {
      var el = document.querySelector(list[i]);
      if (el) return el;
    }
    return null;
  }

  /**
   * The TinyMCE instance backing a field, when one is active and visible.
   * The instance is keyed on the textarea's own ID, so it is read off the
   * resolved element rather than assumed.
   */
  function editorFor(el) {
    if (!el || !el.id || typeof window.tinymce === 'undefined') return null;
    var ed = window.tinymce.get(el.id);
    return (ed && !ed.isHidden()) ? ed : null;
  }

  function readField(field) {
    var el = fieldEl(field);
    if (!el) return '';
    var ed = editorFor(el);
    if (ed) return ed.getContent({ format: 'text' }).trim();
    return el.value.trim();
  }

  function writeField(field, text) {
    var el = fieldEl(field);
    if (!el) {
      say('✗ Could not find the ' + field + ' field on this screen.', 'bad');
      return false;
    }

    var ed = editorFor(el);
    if (ed) {
      ed.setContent(text);
      ed.fire('change');
      // Keep the textarea in step so a Visual→Text switch, or a save that
      // reads the textarea directly, sees the same value.
      el.value = text;
      return true;
    }

    el.value = text;
    // Let anything else listening on the page notice the change.
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.classList.add('lmtbox-flash');
    setTimeout(function () { el.classList.remove('lmtbox-flash'); }, 1200);
    return true;
  }

  function markFilled(field, filled) {
    var btn = box.querySelector('.lmtbox-gen[data-field="' + field + '"]');
    var dot = btn && btn.closest('.lmtbox-row').querySelector('.lmtbox-dot');
    if (dot) dot.className = 'lmtbox-dot ' + (filled ? 'is-on' : 'is-off');
  }

  function request(field) {
    // Alt text has its own long-standing endpoint and prompt; caption and
    // description share the v3.20.0 one.
    var action = (field === 'alt') ? 'lmt_ai_alt_generate' : 'lmt_meta_generate';
    var body   = { action: action, nonce: window.LMT_BOX.nonce, id: id };
    if (field !== 'alt') body.field = field;

    return fetch(window.LMT_BOX.ajax, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body)
    }).then(function (r) { return r.json(); });
  }

  function generate(field, btn) {
    var label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Working…'; }
    say('Generating ' + field + '…', 'working');

    return request(field)
      .then(function (res) {
        if (!res.success) {
          say('✗ ' + (res.data || 'Generation failed'), 'bad');
          return false;
        }
        var text = res.data.text || res.data.alt || '';
        if (!text) {
          say('✗ The platform returned nothing for ' + field + '.', 'bad');
          return false;
        }
        writeField(field, text);
        markFilled(field, true);
        say('Filled ' + field + '. Press Update to save.', 'ok');
        return true;
      })
      .catch(function (err) {
        say('✗ ' + err.message, 'bad');
        return false;
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = label || 'Generate'; }
      });
  }

  box.querySelectorAll('.lmtbox-gen').forEach(function (btn) {
    btn.addEventListener('click', function () {
      generate(btn.dataset.field, btn);
    });
  });

  var fillBtn = document.getElementById('lmtbox-fill-empty');
  if (fillBtn) {
    fillBtn.addEventListener('click', function () {
      var todo = ['alt', 'caption', 'description'].filter(function (f) {
        return readField(f) === '';
      });
      if (!todo.length) {
        say('Nothing empty to fill.', null);
        return;
      }
      fillBtn.disabled = true;
      var done = 0;
      // Sequential rather than parallel: each call is a metered Bedrock
      // request, and a failure part way through should leave the earlier
      // results in place.
      todo.reduce(function (chain, field) {
        return chain.then(function () {
          var btn = box.querySelector('.lmtbox-gen[data-field="' + field + '"]');
          return generate(field, btn).then(function (ok) { if (ok) done++; });
        });
      }, Promise.resolve()).then(function () {
        fillBtn.disabled = false;
        if (done) say('Filled ' + done + ' field' + (done === 1 ? '' : 's') + '. Press Update to save.', 'ok');
      });
    });
  }

  // Keep the dots honest if the user edits a field by hand.
  Object.keys(TARGETS).forEach(function (field) {
    var el = fieldEl(field);
    if (!el) return;
    el.addEventListener('input', function () {
      markFilled(field, el.value.trim() !== '');
    });
  });
})();
