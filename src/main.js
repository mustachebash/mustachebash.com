import 'normalize.css';
import 'swiper/less';
import 'main.less';

import url from 'url';
import client from 'braintree-web/client';
import hostedFields from 'braintree-web/hosted-fields';
import Swiper from 'swiper';

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

// Set some state here
const cart = [],
	customer = {},
	products = {},
	pageSettings = {
		serviceFee: 0
	};

let promo;

// Animate Nav links - quick n dirty vanilla style
// TODO: Make this less janky
let scrollAnimationReqId;
document.querySelectorAll('nav, #hero-cta, #afterparty-cta').forEach(el => el.addEventListener('click', e => {
	if(e.target.hash) {
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
	document.querySelector('#video a').addEventListener('click', () => {
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

// Gallery
try {
	const gallerySize = window.innerWidth > 768 ? 'Desktop' : 'Mobile',
		slidesHtml = [];
	for (let i = 1; i < 15; i++) {
		// TODO: these are manually managed currently - find a better way to host/manage these
		slidesHtml.push(`
			<div class="swiper-slide">
				<img data-src="./img/gallery/Gallery_${gallerySize}_2022_${i}.jpg" class="swiper-lazy" />
				<div class="swiper-lazy-preloader swiper-lazy-preloader-white"></div>
			</div>
		`);
	}

	document.querySelector('.swiper-wrapper').innerHTML = slidesHtml.join('\n');

	// eslint-disable-next-line no-unused-vars
	const gallerySwiper = new Swiper(document.querySelector('#gallery'), {
		lazy: {
			loadPrevNext: true
		},
		loop: true,
		pagination: {
			el: '.swiper-pagination'
		},
		navigation: {
			nextEl: '.swiper-button-next',
			prevEl: '.swiper-button-prev'
		},
		on: {
			slideNextTransitionEnd: () => {
				if(typeof window.gtag === 'function') {
					window.gtag('event', 'click', {
						event_category: 'gallery',
						event_label: 'Next Slide'
					});
				}
			},
			slidePrevTransitionEnd: () => {
				if(typeof window.gtag === 'function') {
					window.gtag('event', 'click', {
						event_category: 'gallery',
						event_label: 'Previous Slide'
					});
				}
			}
		}
	});
} catch(e) {
	console.error('Gallery failed to load', e);
	logError(e);
}

// Never allow this form to submit
document.forms.purchase.addEventListener('submit', e => {
	e.preventDefault();
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

					const tick = document.querySelectorAll('.ticks > div')[2];
					tick.classList.remove('active');
					tick.classList.add('complete');
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

function updateSubtotals() {
	const subtotal = cart.reduce((tot, cur) => tot + (cur.quantity * products[cur.productId].price), 0),
		orderSummaryList = document.querySelector('.order-summary dl');

	document.querySelector('#grand-total span').innerText = subtotal;

	orderSummaryList.innerHTML = '';

	cart.forEach(i => {
		const product = products[i.productId];

		orderSummaryList.innerHTML += `
			<dt>${product.name} (<span class="quantity">${i.quantity}</span>)</dt>
			<dd>$<span class="subtotal">${i.quantity * product.price}</span></dd>
		`;
	});
}

const quantityControls = document.querySelector('.quantity-controls');
function addItemToCart(id) {
	const cartItemIndex = cart.findIndex(i => i.productId === id);

	if(~cartItemIndex) {
		// 4 ticket max
		if(cart[cartItemIndex].quantity >= 4) return;

		cart[cartItemIndex].quantity++;

		if(cart[cartItemIndex].quantity === 4) quantityControls.querySelector('.plus').classList.add('disabled');
		if(cart[cartItemIndex].quantity > 1) quantityControls.querySelector('.minus').classList.remove('disabled');

		quantityControls.querySelector('.quantity').innerText = cart[cartItemIndex].quantity;
	} else {
		cart.push({
			productId: id,
			quantity: 1
		});

		quantityControls.querySelector('.quantity').innerText = 1;
	}

	updateSubtotals();
}

function removeItemFromCart(id) {
	const cartItemIndex = cart.findIndex(i => i.productId === id);

	if(~cartItemIndex) {
		cart[cartItemIndex].quantity--;

		quantityControls.querySelector('.quantity').innerText = cart[cartItemIndex].quantity;
		quantityControls.querySelector('.plus').classList.remove('disabled');

		// One is the minimum
		if(cart[cartItemIndex].quantity === 1) {
			quantityControls.querySelector('.minus').classList.add('disabled');
		}
	}

	updateSubtotals();
}

function purchaseFlowInit(hostedFieldsInstance) {
	const ticketsList = document.querySelector('#tickets-list'),
		ticketsListHTML = [];

	if(!promo) {
		for(const id of pageSettings.ticketsOrder) {
			if(!products[id]) continue;
			const { name, description, price, status } = products[id],
				classes = [];

			if(status !== 'active' || !pageSettings.currentTicket) classes.push('disabled');
			if(status === 'archived') classes.push('sold-out');

			ticketsListHTML.push(`<h6 class="${classes.join(' ')}" data-product-id="${id}">${name} $${price}<sup>${description}</sup></h6>`);
		}

		ticketsList.innerHTML = ticketsListHTML.join('\n');

		// Preselect a ticket
		if(pageSettings.currentTicket && products[pageSettings.currentTicket] && products[pageSettings.currentTicket].status === 'active') {
			addItemToCart(pageSettings.currentTicket);
		} else {
			document.querySelector('.tickets-flow').innerHTML = `
				<div class="sales-off">
					<h5>
						Tickets are currently not available for&nbsp;sale - check back soon!
					</h5>
				</div>`;

			return;
		}

		// Ticket Flow with a precarious dependency on DOM order
		// Step 1
		document.querySelector('#confirm-quantity').addEventListener('click', () => {
			// Make sure there's items in the cart to purchase
			const valid = cart.length;

			if(valid) {
				window.requestAnimationFrame(() => {
					document.querySelectorAll('.step')[0].classList.remove('active');
					document.querySelectorAll('.step')[1].classList.add('active');

					const ticks = document.querySelectorAll('.ticks > div');
					ticks[0].classList.remove('active');
					ticks[0].classList.add('complete');
					ticks[1].classList.add('active');
					document.querySelectorAll('.leg')[0].classList.add('active');
				});

				if(typeof window.gtag === 'function') {
					try {
						window.gtag('event', 'begin_checkout', {
							checkout_step: 1,
							items: cart.map(i => ({
								id: i.productId,
								quantity: i.quantity,
								name: products[i.productId].name,
								category: 'Tickets',
								price: String(products[i.productId].price)
							}))
						});
					} catch(e) {
						// Don't let gtag break the site
					}
				}
			}
		});
	} else if(promo.type === 'single-use') {
		cart.push({
			productId: promo.product.id,
			quantity: 1
		});

		const steps = document.querySelector('.steps'),
			promoInfo = document.createElement('h5');

		promoInfo.innerHTML = `Promo Ticket: ${promo.product.name} - $${promo.price}`;

		steps.parentNode.insertBefore(promoInfo, steps);

		const subtotal = promo.price,
			orderSummaryList = document.querySelector('.order-summary dl');

		document.querySelector('#grand-total span').innerText = subtotal;

		orderSummaryList.innerHTML = `
			<dt>${promo.product.name} (<span class="quantity">1</span>)</dt>
			<dd>$<span class="subtotal">${subtotal}</span></dd>
		`;

		window.requestAnimationFrame(() => {
			document.querySelectorAll('.step')[0].classList.remove('active');
			document.querySelectorAll('.step')[1].classList.add('active');

			const ticks = document.querySelectorAll('.ticks > div');
			ticks[0].classList.remove('active');
			ticks[0].classList.add('complete');
			ticks[1].classList.add('active');
			document.querySelectorAll('.leg')[0].classList.add('active');
		});
	}

	// Step 2
	document.querySelector('#enter-payment').addEventListener('click', () => {
		// Let's get ridiculous so we can check
		let nameValid = false,
			emailValid = false,
			paymentValid = false;

		const fullName = document.querySelector('input[name="name"]').value,
			email = document.querySelector('input[name="email"]').value,
			state = hostedFieldsInstance.getState();

		// Not much name validation - your bad if you put in a fake name for a guest list
		if(!fullName || fullName.trim().split(' ').length < 2) {
			// redundant here, but done for explicitness
			nameValid = false;
			document.querySelector('fieldset[name="name"]').classList.add('invalid');
		} else {
			nameValid = true;
			document.querySelector('fieldset[name="name"]').classList.remove('invalid');
		}

		// There's no such thing as a simple email validator - but again, your bad if you put in a shit email for confirmation
		if(!email || !/^\S+@\S+\.\S{2,}$/.test(email.trim())) {
			emailValid = false;
			document.querySelector('fieldset[name="email"]').classList.add('invalid');
		} else {
			emailValid = true;
			document.querySelector('fieldset[name="email"]').classList.remove('invalid');
		}

		// Check the braintree fields with this slick copy/paste job they provided
		paymentValid = Object.keys(state.fields).every(key => state.fields[key].isValid);

		if(nameValid && emailValid && paymentValid) {
			customer.email = email.trim();
			customer.firstName = fullName.trim().split(' ')[0];
			customer.lastName = fullName.trim().split(' ').slice(1).join(' ');

			document.querySelector('.reservation-details-name').innerText = fullName.trim();
			document.querySelector('.reservation-details-email').innerText = email.trim();

			window.requestAnimationFrame(() => {
				document.querySelectorAll('.step')[1].classList.remove('active');
				document.querySelectorAll('.step')[2].classList.add('active');

				const ticks = document.querySelectorAll('.ticks > div');
				ticks[1].classList.remove('active');
				ticks[1].classList.add('complete');
				ticks[2].classList.add('active');
				document.querySelectorAll('.leg')[1].classList.add('active');
			});

			if(typeof window.gtag === 'function' && !promo) {
				try {
					window.gtag('event', 'checkout_progress', {
						checkout_step: 2,
						items: cart.map(i => ({
							id: i.productId,
							quantity: i.quantity,
							name: products[i.productId].name,
							category: 'Tickets',
							price: String(products[i.productId].price)
						}))
					});
				} catch(e) {
					// Don't let gtag break the site
				}
			}
		}
	});

	if(!promo) {
		document.querySelector('#back-to-quantity').addEventListener('click', e => {
			e.preventDefault();
			window.requestAnimationFrame(() => {
				document.querySelectorAll('.step')[1].classList.remove('active');
				document.querySelectorAll('.step')[0].classList.add('active');

				const ticks = document.querySelectorAll('.ticks > div');
				ticks[1].classList.remove('active');
				ticks[0].classList.remove('complete');
				ticks[0].classList.add('active');
				document.querySelectorAll('.leg')[0].classList.remove('active');
			});
		});
	} else {
		document.querySelector('#back-to-quantity').remove();
	}

	// Step 3
	let submitting = false;
	document.querySelector('#confirm-order').addEventListener('click', () => {
		// Cool it, cowboy
		if(submitting) return;

		submitting = true;
		document.querySelector('#confirm-order').innerText = 'Processing...';
		document.querySelector('#confirm-order').disabled = true;
		document.querySelector('#back-to-payment').style.display = 'none';

		if(typeof window.gtag === 'function' && !promo) {
			try {
				window.gtag('event', 'checkout_progress', {
					checkout_step: 3,
					items: cart.map(i => ({
						id: i.productId,
						quantity: i.quantity,
						name: products[i.productId].name,
						category: 'Tickets',
						price: String(products[i.productId].price)
					}))
				});
			} catch(e) {
				// Don't let gtag break the site
			}
		}

		hostedFieldsInstance.tokenize({cardholderName: `${customer.firstName} ${customer.lastName}`})
			.then(({ nonce }) => fetch(API_HOST + '/v1/transactions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					paymentMethodNonce: nonce,
					customer,
					cart,
					promoId: promo && promo.id
				})
			}))
			.then(response => {
				// Check for HTTP error statuses, throw errors to skip processing response body
				if(response.status >= 400) {
					const err = new Error(response.statusText);

					err.status = response.status;

					throw err;
				}

				return Promise.all([response.headers, response.json()]);
			})
			.then(([ headers, { confirmationId, token } ]) => {
				window.requestAnimationFrame(() => {
					document.querySelectorAll('.step')[2].classList.remove('active');
					document.querySelectorAll('.step')[3].classList.add('active');

					document.querySelector('.confirmation-number span').innerText = `#${confirmationId}`;
					document.querySelector('.tickets-link a').href = `/mytickets?t=${token}`;

					const tick = document.querySelectorAll('.ticks > div')[2];
					tick.classList.remove('active');
					tick.classList.add('complete');
				});

				if(typeof window.gtag === 'function') {
					try {
						const total = cart.reduce((tot, cur) => tot + (cur.quantity * products[cur.productId].price), 0),
							transactionId = headers.get('Location').split('/').pop(),
							eventData = {
								transaction_id: transactionId,
								value: total,
								currency: 'USD',
								checkout_step: 4,
								items: cart.map(i => ({
									id: i.productId,
									quantity: i.quantity,
									name: products[i.productId].name,
									category: 'Tickets',
									price: String(products[i.productId].price)
								}))
							};

						window.gtag('event', 'purchase', eventData);

						window.gtag('event', 'conversion', {
							...eventData,
							send_to: 'AW-704569520/g7y6CKfiiboBELDB-88C'
						});
					} catch(e) {
						// Don't let gtag break the site
					}
				}

				if(typeof window.fbq === 'function') {
					try {
						const total = cart.reduce((tot, cur) => tot + (cur.quantity * products[cur.productId].price), 0);

						window.fbq('track', 'Purchase', {
							value: total,
							currency: 'USD',
							contents: cart.map(i => ({
								id: i.productId,
								quantity: i.quantity,
								item_price: Number(products[i.productId].price)
							}))
						});
					} catch(e) {
						// Don't let FB break the site
					}
				}
			})
			.catch(e => {
				submitting = false;
				document.querySelector('#confirm-order').innerText = 'Purchase';
				document.querySelector('#confirm-order').disabled = false;
				document.querySelector('#back-to-payment').style.display = '';

				// eslint-disable-next-line
				alert('Order Failed, please check your payment details and try again');

				console.error('Payment Error', e);
			});
	});

	document.querySelector('#back-to-payment').addEventListener('click', e => {
		// Can't go back now
		if(submitting) return;

		e.preventDefault();
		window.requestAnimationFrame(() => {
			document.querySelectorAll('.step')[2].classList.remove('active');
			document.querySelectorAll('.step')[1].classList.add('active');

			const ticks = document.querySelectorAll('.ticks > div');
			ticks[2].classList.remove('active');
			ticks[1].classList.remove('complete');
			ticks[1].classList.add('active');
			document.querySelectorAll('.leg')[1].classList.remove('active');
		});
	});

	if(!promo && pageSettings.currentTicket) {
		// Quantity controls
		document.querySelectorAll('.plus').forEach(plus => plus.addEventListener('click', e => {
			if(e.currentTarget.classList.contains('disabled')) return;

			// Increment based on product row data
			addItemToCart(pageSettings.currentTicket);
		}));

		document.querySelectorAll('.minus').forEach(minus => minus.addEventListener('click', e => {
			if(e.currentTarget.classList.contains('disabled')) return;

			// Decrement
			removeItemFromCart(pageSettings.currentTicket);
		}));
	}
}

// Setup braintree client
function braintreeInit() {
	return client.create({authorization: BRAINTREE_TOKEN})
		.then(clientInstance => hostedFields.create({
			client: clientInstance,
			styles: {
				input: {
					'font-size': '16px',
					color: '#0e2245'
				},
				'.invalid': {
					color: '#e66a40'
				},
				':focus': {
					outline: 0
				},
				'::placeholder': {
					color: 'rgba(14,34,69,.5)'
				}
			},
			fields: {
				number: {
					selector: '#card-number',
					placeholder: 'Card Number'
				},
				cvv: {
					selector: '#cvv',
					placeholder: 'CVV'
				},
				expirationDate: {
					selector: '#expiration',
					placeholder: 'MM/YYYY'
				}
			}
		}))
		.then(purchaseFlowInit)
		.catch(e => {
			console.error('Braintree/Payments Error', e);

			// Throw to show the payments error message
			throw e;
		});
}

const { promo: promoId } = url.parse(location.href, true).query;

if(!promoId) {
	// Fetch the initial settings and products
	fetch(API_HOST + '/v1/sites/mustachebash.com/settings')
		.then(response => {
			if(!response.ok) throw new Error('Settings not loaded');

			return response;
		})
		.then(response => response.json())
		.then(({ settings, products: siteProducts, events }) => {
			siteProducts.forEach(p => products[p.id] = p);

			Object.assign(pageSettings, {
				...settings,
				...events[0] && {currentTicket: events[0].currentTicket}
			});
		})
		.catch(e => {
			console.error('Settings Error', e);

			throw e;
		})
		.then(braintreeInit)
		.catch(e => {
			// If anything errors, we need to show a message in the tickets section
			// eslint-disable-next-line max-len
			document.querySelector('.tickets-flow').innerHTML = '<h5 style="padding-top: 5em; color: #602a34; text-align: center">Something seems to be broken,<br>please refresh the page and try again</h5>';

			logError(e);
		});
} else {
	// Fetch the initial settings and products
	fetch(`${API_HOST}/v1/promos/${promoId}`)
		.then(response => {
			if(!response.ok) {
				const err = new Error('Promo Error');

				err.status = response.status;
				throw err;
			}

			return response;
		})
		.then(response => response.json())
		.then(responseJson => promo = responseJson)
		.then(braintreeInit)
		.catch(e => {
			let promoMessage;
			switch(e.status) {
				case 404:
					promoMessage = 'Promo Code is not valid';
					break;

				case 410:
					promoMessage = 'Promo Code is no longer valid';
					break;

				default:
					promoMessage = 'Something seems to be broken,<br>please refresh the page and try again';
					break;
			}

			document.querySelector('.tickets-flow').innerHTML = `<h5 style="padding-top: 5em; color: #e66a40; text-align: center">${promoMessage}</h5>`;
		});
}
