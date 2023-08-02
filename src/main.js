import 'normalize.css';
import 'main.less';

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

// Animate Nav links - quick n dirty vanilla style
// TODO: Make this less janky
let scrollAnimationReqId;
document.querySelectorAll('nav').forEach(el => el.addEventListener('click', e => {
	if(e.target.hash && e.target.pathname === location.pathname) {
		e.preventDefault();

		// Track hero CTA clicks
		if(typeof window.gtag === 'function' && e.target.id === 'hero-cta') {
			window.gtag('event', 'click', {
				event_category: 'CTA',
				event_label: 'Hero Tickets Link'
			});
		}

		window.cancelAnimationFrame(scrollAnimationReqId);

		document.querySelector('#menu-icon').classList.remove('open');

		// Offset by 90/77px for the header
		const offset = window.innerWidth > 768 ? 90 : 77,
			scrollPos = document.querySelector(e.target.hash).offsetTop - offset,
			scrollPerFrame =  (scrollPos - window.scrollY)/(60 * (300/1000));

		const scrollAnimation = () => {
			scrollAnimationReqId = window.requestAnimationFrame(scrollAnimation);

			const currentPos = window.scrollY;

			if((scrollPerFrame > 1 && currentPos >= scrollPos) || (scrollPerFrame < 1 && currentPos <= scrollPos)) {
				window.scrollTo(0, scrollPos);
				return window.cancelAnimationFrame(scrollAnimationReqId);
			}

			window.scrollTo(0, currentPos + scrollPerFrame);
		};

		scrollAnimation();
	}
}));

// Track video link clicks
// Track hero CTA clicks
if(typeof window.gtag === 'function') {
	document.querySelector('.video a').addEventListener('click', () => {
		window.gtag('event', 'click', {
			event_category: 'CTA',
			event_label: 'Video Link'
		});
	});
}

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
