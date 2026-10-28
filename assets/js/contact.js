/* Formulaire de contact du pied de page (envoi via Formsubmit). */
// Remplace le pied de page par un formulaire de contact (client mailto)
      (function () {
        var footer = document.getElementById('contactSlot');
        if (!footer) return;
        footer.innerHTML = '' +
          '<h2 class="contact-title">Nous écrire</h2>' +
          '<form id="contactForm" class="contact-form" onsubmit="return false" novalidate>' +
          '  <label for="contactEmail">Email</label>' +
          '  <input type="email" id="contactEmail" placeholder="votre@email" required />' +
          '  <label for="contactMessage">Message</label>' +
          '  <textarea id="contactMessage" rows="4" placeholder="Votre message…" required></textarea>' +
          '  <button id="contactSend" class="btn" type="button" style="display:none" disabled>Envoyer</button>' +
          '  <p id="contactHint" class="hint">Saisissez un email valide et au moins un mot.</p>' +
          '</form>' ;

        var email = document.getElementById('contactEmail');
        var msg = document.getElementById('contactMessage');
        var send = document.getElementById('contactSend');
        var emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
        function isValid() {
          var okMail = emailRe.test((email.value || '').trim());
          var text = (msg.value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
          var okMsg = /\b\w+\b/.test(text);
          if (okMail && okMsg) {
            send.style.display = 'inline-block';
            send.disabled = false;
          } else {
            send.style.display = 'none';
            send.disabled = true;
          }
        }
        email.addEventListener('input', isValid);
        msg.addEventListener('input', isValid);
        send.addEventListener('click', function () {
          if (send.disabled) return;
          send.disabled = true;
          send.textContent = 'Envoi…';
          var endpoint = 'https://formsubmit.co/ajax/allandiaye96@gmail.com';
          var payload = {
            email: (email.value || '').trim(),
            message: (msg.value || '').trim(),
            _subject: 'Contact CrashPlaneWebsite'
          };
          fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
          }).then(function (r) { return r.json(); })
            .then(function (data) {
              send.textContent = 'Envoyé';
              var hint = document.getElementById('contactHint');
              if (hint) {
                hint.textContent = 'Merci, votre message a été envoyé. (Si c’est votre premier envoi, vérifiez l’email de confirmation Formsubmit pour activer le formulaire.)';
              }
              email.value = '';
              msg.value = '';
              setTimeout(function(){ send.textContent = 'Envoyer'; isValid(); }, 2500);
            })
            .catch(function (err) {
              console.error(err);
              send.textContent = 'Réessayer';
              var hint = document.getElementById('contactHint');
              if (hint) { hint.textContent = 'Échec de l’envoi. Vérifiez votre connexion et réessayez.'; }
              setTimeout(function(){ isValid(); }, 1500);
            });
        });
        isValid();
      })();
