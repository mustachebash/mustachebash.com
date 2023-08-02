import 'normalize.css';
import 'info.less';

function logError({ lineno, colno, message, filename, stack, name }) {
	fetch(API_HOST + '/v1/errors', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			lineno,
			colno,
			message,
			filename,
			name,
			stack,
			path: location.href
		})
	})
		.catch(console.error);
}

// Global error listener
window.addEventListener('error', e => {
	const { lineno, colno, message, filename, error: { stack, name } = {} } = e;

	logError({ lineno, colno, message, filename, stack, name });
});

// Mobile menu
document.querySelector('#menu-icon').addEventListener('click', e => {
	e.currentTarget.classList.toggle('open');
});

// Never allow this form to submit
let submittingNewsletter = false;
document.forms.newsletter.addEventListener('submit', e => {
	e.preventDefault();

	const subscriber = {};
	// Let's get ridiculous so we can check
	let nameValid = false,
		emailValid = false;

	const fullName = document.querySelector('input[name="newsletter-name"]').value,
		email = document.querySelector('input[name="newsletter-email"]').value;

	// Not much name validation - your bad if you put in a fake name for a guest list
	if(!fullName || fullName.trim().split(' ').length < 2) {
		// redundant here, but done for explicitness
		nameValid = false;
		document.querySelector('fieldset[name="newsletter-name"]').classList.add('invalid');
	} else {
		nameValid = true;
		document.querySelector('fieldset[name="newsletter-name"]').classList.remove('invalid');
	}

	// There's no such thing as a simple email validator - but again, your bad if you put in a shit email for confirmation
	if(!email || !/^\S+@\S+\.\S{2,}$/.test(email.trim())) {
		emailValid = false;
		document.querySelector('fieldset[name="newsletter-email"]').classList.add('invalid');
	} else {
		emailValid = true;
		document.querySelector('fieldset[name="newsletter-email"]').classList.remove('invalid');
	}

	if(nameValid && emailValid) {
		subscriber.email = email.trim();
		subscriber.firstName = fullName.trim().split(' ')[0];
		subscriber.lastName = fullName.trim().split(' ').slice(1).join(' ');

		// Cool it, cowboy
		if(submittingNewsletter) return;

		submittingNewsletter = true;
		const previousButtonText = document.querySelector('#newsletter-submit').innerText;
		document.querySelector('#newsletter-submit').innerText = 'Signing Up...';
		document.querySelector('#newsletter-submit').disabled = true;

		fetch(API_HOST + '/v1/sites/mustachebash.com/mailing-list', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(subscriber)
		})
			.then(response => {
				// Check for HTTP error statuses, throw errors to skip processing response body
				if(response.status >= 400) {
					const err = new Error(response.statusText);

					err.status = response.status;

					throw err;
				}

				// This 204's on success
				return;
			})
			.then(() => {
				window.requestAnimationFrame(() => {
					document.querySelector('input[name="newsletter-email"]').value = '';
					document.querySelector('input[name="newsletter-name"]').value = '';
					document.querySelector('#newsletter-success').style.visibility = 'visible';
				});
			})
			.catch(e => {
				// eslint-disable-next-line
				alert('Sign Up Failed, please check your subscriber details and try again');

				console.error('Newsletter Error', e);
			})
			.finally(() => {
				submittingNewsletter = false;
				document.querySelector('#newsletter-submit').innerText = previousButtonText;
				document.querySelector('#newsletter-submit').disabled = false;
			});
	}
});
