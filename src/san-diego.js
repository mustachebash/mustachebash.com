import 'normalize.css';
import 'san-diego.less';

import client from 'braintree-web/client';
import hostedFields from 'braintree-web/hosted-fields';
import applePay from 'braintree-web/apple-pay';

import { format } from 'date-fns';

const EVENT_2024_ID = '45fdbc90-19a1-4a5c-ac69-345afceb5d39';
const EVENT_2024_AFTERPARTY_ID = '998dedab-1eff-42f8-b8c0-7f3de541e979';

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
document.querySelectorAll('nav, #hero-cta, #afterparty-cta').forEach(el => el.addEventListener('click', e => {
	if(e.target.hash && e.target.pathname === window.location.pathname) {
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

// Set some state here
const customer = {},
	products = {},
	events = {};

let cart = [],
	promo;

// Track video link clicks
// Track hero CTA clicks
if(typeof window.gtag === 'function') {
	document.querySelector('.video a').addEventListener('click', () => {
		window.gtag('event', 'click', {
			event_category: 'CTA',
			event_label: 'SD Video Link'
		});
	});
}

// Mobile menu
document.querySelector('#menu-icon').addEventListener('click', e => {
	e.currentTarget.classList.toggle('open');
});

// Requires tickets section
// Never allow this form to submit
document.forms['payment-info'].addEventListener('submit', e => {
	e.preventDefault();
});

// Requires tickets section
// Never allow this form to submit
document.forms['personal-info'].addEventListener('submit', e => {
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
function updateCartQuantities() {
	cart = [];
	quantityControls.querySelectorAll('.ticket select').forEach(el => {
		const qty = Number(el.value);
		if(qty) {
			cart.push({
				productId: el.name.replace('-quantity', ''),
				quantity: qty
			});
		}
	});

	if(!cart.length) {
		document.querySelector('#confirm-quantity').disabled = true;
	} else {
		document.querySelector('#confirm-quantity').disabled = false;
	}

	updateSubtotals();
}

const targetGuestId = (new URLSearchParams(location.search).get('targetGuestId')) ?? undefined;
function completePurchase(nonce) {
	return fetch(API_HOST + '/v1/orders', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			paymentMethodNonce: nonce,
			customer,
			cart,
			promoId: promo && promo.id,
			targetGuestId
		})
	})
		.then(response => {
			// Check for HTTP error statuses, throw errors to skip processing response body
			if(response.status >= 400) {
				const err = new Error(response.statusText);

				err.status = response.status;

				throw err;
			}

			return Promise.all([response.headers, response.json()]);
		})
		.then(([ headers, { confirmationId, orderId, token } ]) => {
			window.requestAnimationFrame(() => {
				// In case Apple Pay takes us here
				document.querySelectorAll('.step')[2].classList.remove('active');
				document.querySelectorAll('.step')[3].classList.remove('active');
				document.querySelectorAll('.step')[4].classList.add('active');

				document.querySelector('.confirmation-number span').innerText = `#${confirmationId}`;
				document.querySelector('.order-number span').innerText = `#${orderId.slice(0, 8)}`;

				if(targetGuestId) {
					document.querySelector('.tickets-link a').style.display = 'none';
					// eslint-disable-next-line max-len
					document.querySelector('.confirmation-message').innerText = 'Thanks for purchasing a VIP upgrade! Your tickets have been upgraded. Use the link sent in your original purchase to access your tickets.';
				} else {
					document.querySelector('.tickets-link a').href = `/mytickets?t=${token}`;
				}

				const tick = document.querySelectorAll('.ticks > div')[3];
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
							checkout_step: 5,
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
		});
}

function purchaseFlowInit({hostedFieldsInstance, applePayInstance}) {
	const ticketsList = document.querySelector('#tickets-list'),
		quantitiesHTML = [],
		ticketsListHTML = [],
		now = (new Date()).toISOString();

	if(!promo) {
		for(const id of Object.values(events).flatMap(({meta}) => meta.ticketsOrder)) {
			if(!products[id]) continue;
			const { name, price, status, eventId, admissionTier } = products[id],
				isVip = admissionTier === 'vip',
				classes = [];

			if(
				status !== 'active' ||
				!Object.values(events).some(ev => ev.salesEnabled) ||
				!events[eventId].meta.currentTicket ||
				now < events[eventId].openingSales
			) classes.push('disabled');

			if(status === 'archived') classes.push('sold-out');

			ticketsListHTML.push(`<h6 class="${classes.join(' ')}" data-product-id="${id}">${name} - $${price}</h6>`);

			if(status === 'active' && events[eventId].salesEnabled && (events[eventId].meta.currentTicket === id || isVip) && now > events[eventId].openingSales) {
				// The regex check is janky, but we don't want to pre-populate afterparty ticket quantities
				quantitiesHTML.push(`
					<div class="ticket flex-row flex-row-mobile">
						<div class="ticket-name"><span>${name}</span></div>
						<div class="select-wrap">
							<select name="${id}-quantity">
								<option ${/afterparty/i.test(events[eventId].name) || isVip ? 'selected' : ''} value="0">0</option>
								<option ${!/afterparty/i.test(events[eventId].name) && !isVip ? 'selected' : ''} value="1">1</option>
								<option value="2">2</option>
								<option value="3">3</option>
								<option value="4">4</option>
							</select>
						</div>
					</div>
				`);
			}
		}

		ticketsList.innerHTML = ticketsListHTML.join('\n');
		quantityControls.innerHTML = quantitiesHTML.join('\n');

		const earliestOpeningSalesDate = Object.values(events).reduce((earliest, cur) => {
			if(cur.salesEnabled && cur.openingSales < earliest) return cur.openingSales;
			return earliest;
		}, '2040-12-31T00:00:00.000Z');

		// If we aren't on sale yet
		if(now < earliestOpeningSalesDate) {
			document.querySelector('.ticket-image').style.display = 'none';
			document.querySelector('.tickets-flow').innerHTML = `
				<div class="sales-off">
					<h5>
						Tickets on sale ${format(earliestOpeningSalesDate, 'cccc M/d/yy, haaa')}!
					</h5>
				</div>`;

			return;
		} else if(Object.values(events).some(ev => ev.salesEnabled) && quantitiesHTML.length) {
			// Set the quantities if at least one event has ticket sales turned on, otherwise jump ship
			updateCartQuantities();

			// Bind the quantity listener
			quantityControls.addEventListener('change', () => {
				updateCartQuantities();
			});
		} else {
			document.querySelector('.ticket-image').style.display = 'none';
			document.querySelector('.tickets-flow').innerHTML = `
				<div class="sales-off">
					<h5>
						Tickets are not currently available
					</h5>
				</div>`;

			return;
		}

		// Set up Apple Pay listeners
		if(applePayInstance) {
			// Show the Apple Pay button and acceptance mark
			document.querySelector('.apple-pay').style.display = 'block';
			document.querySelector('.apple-pay-button').addEventListener('click', () => {
				window.gtag('event', 'click', {
					event_category: 'CTA',
					event_label: 'Apple Pay'
				});

				// "Advance" the UI
				window.requestAnimationFrame(() => {
					const ticks = document.querySelectorAll('.ticks > div');
					ticks[2].classList.remove('active');
					ticks[2].classList.add('complete');
					ticks[3].classList.add('active');
					document.querySelectorAll('.leg')[2].classList.add('active');
				});

				// This is kinda funky, but people are basically getting to the "review" step here
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

				const paymentRequest = applePayInstance.createPaymentRequest({
						total: {
							label: 'Total (All sales final)',
							amount: cart.reduce((tot, cur) => tot + (cur.quantity * products[cur.productId].price), 0)
						},
						lineItems: cart.map(i => ({
							label: `${products[i.productId].name} (${i.quantity} qty)`,
							type: 'final',
							amount: products[i.productId].price * i.quantity
						})),
						billingContact: {
							emailAddress: customer.email,
							givenName: customer.firstName,
							familyName: customer.lastName
						},
						shippingMethods: [{
							label: `Free Electronic Delivery`,
							detail: `Tickets sent to ${customer.email}`,
							amount: 0,
							identifier: 'electronicDelivery'
						}],
						requiredBillingContactFields: ['email']
					}),
					appleSession = new window.ApplePaySession(3, paymentRequest);

				appleSession.onvalidatemerchant = event => {
					applePayInstance.performValidation({validationURL: event.validationURL, displayName: 'Mustache Bash'})
						.then(merchantSession => appleSession.completeMerchantValidation(merchantSession))
						.catch(err => {
							appleSession.abort();
							console.error(err);

							// Revert the UI
							window.requestAnimationFrame(() => {
								const ticks = document.querySelectorAll('.ticks > div');
								ticks[2].classList.add('active');
								ticks[2].classList.remove('complete');
								ticks[3].classList.remove('active');
								document.querySelectorAll('.leg')[2].classList.remove('active');
							});
						});
				};

				appleSession.onpaymentauthorized = event => {
					applePayInstance.tokenize({token: event.payment.token})
						.then(payload => {
							console.log(JSON.stringify(event.payment));

							if(typeof window.gtag === 'function' && !promo) {
								try {
									window.gtag('event', 'checkout_progress', {
										checkout_step: 4,
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

							// After you have transacted with the payload.nonce,
							// call `completePayment` to dismiss the Apple Pay sheet.
							// appleSession.completePayment(window.ApplePaySession.STATUS_SUCCESS);

							return payload.nonce;
						})
						.then(completePurchase)
						.then(() => appleSession.completePayment(window.ApplePaySession.STATUS_SUCCESS))
						.catch(e => {
							appleSession.completePayment(window.ApplePaySession.STATUS_FAILURE);

							if(e.status !== 410) {
								// eslint-disable-next-line
								alert('Order Failed, please check your payment details and try again');
							} else {
								// eslint-disable-next-line
								alert('One or more items has sold out! Refresh to pick a different option');
								window.location.reload();
							}

							console.error('Payment Error', e);
						});
				};

				appleSession.begin();
			});
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
			quantity: promo.productQuantity
		});

		const steps = document.querySelector('.steps'),
			promoInfo = document.createElement('h5');

		promoInfo.innerHTML = `Promo Ticket: ${promo.product.name} - $${promo.price}/ea (${promo.productQuantity} qty)`;

		steps.parentNode.insertBefore(promoInfo, steps);

		const subtotal = promo.price * promo.productQuantity,
			orderSummaryList = document.querySelector('.order-summary dl');

		document.querySelector('#grand-total span').innerText = subtotal;

		orderSummaryList.innerHTML = `
			<dt>${promo.product.name} (<span class="quantity">${promo.productQuantity}</span>)</dt>
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
	document.querySelector('#enter-personal-info').addEventListener('click', () => {
		// Let's get ridiculous so we can check
		let nameValid = false,
			emailValid = false;

		const fullName = document.querySelector('input[name="name"]').value,
			email = document.querySelector('input[name="email"]').value;

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

		if(nameValid && emailValid) {
			customer.email = email.trim();
			customer.firstName = fullName.trim().split(' ')[0];
			customer.lastName = fullName.trim().split(' ').slice(1).join(' ');
			customer.marketingOptIn = document.querySelector('input[name="marketing-opt-in"]').checked;

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

	// Step 3
	document.querySelector('#enter-payment-info').addEventListener('click', () => {
		let paymentValid = false;

		const state = hostedFieldsInstance.getState();

		// Check the braintree fields with this slick copy/paste job they provided
		paymentValid = Object.keys(state.fields).every(key => state.fields[key].isValid);


		if(paymentValid) {
			window.requestAnimationFrame(() => {
				document.querySelectorAll('.step')[2].classList.remove('active');
				document.querySelectorAll('.step')[3].classList.add('active');

				const ticks = document.querySelectorAll('.ticks > div');
				ticks[2].classList.remove('active');
				ticks[2].classList.add('complete');
				ticks[3].classList.add('active');
				document.querySelectorAll('.leg')[2].classList.add('active');
			});

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

	document.querySelector('#back-to-personal').addEventListener('click', e => {
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

	// Step 4
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
					checkout_step: 4,
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
			.then(({ nonce }) => completePurchase(nonce))
			.catch(e => {
				submitting = false;
				document.querySelector('#confirm-order').innerText = 'Purchase';
				document.querySelector('#confirm-order').disabled = false;
				document.querySelector('#back-to-payment').style.display = '';

				if(e.status !== 410) {
					// eslint-disable-next-line
					alert('Order Failed, please check your payment details and try again');
				} else {
					// eslint-disable-next-line
					alert('One or more items has sold out! Refresh to pick a different option');
					window.location.reload();
				}

				console.error('Payment Error', e);
			});
	});

	document.querySelector('#back-to-payment').addEventListener('click', e => {
		// Can't go back now
		if(submitting) return;

		e.preventDefault();
		window.requestAnimationFrame(() => {
			document.querySelectorAll('.step')[3].classList.remove('active');
			document.querySelectorAll('.step')[2].classList.add('active');

			const ticks = document.querySelectorAll('.ticks > div');
			ticks[3].classList.remove('active');
			ticks[2].classList.remove('complete');
			ticks[2].classList.add('active');
			document.querySelectorAll('.leg')[2].classList.remove('active');
		});
	});
}

// Setup braintree client
function braintreeInit() {
	return client.create({authorization: BRAINTREE_TOKEN})
		.then(clientInstance => {
			const hostedFieldsPromise = hostedFields.create({
				client: clientInstance,
				styles: {
					input: {
						'font-size': '16px',
						color: '#0e2245'
					},
					'.invalid': {
						color: '#818ed9'
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
			});

			// Apple Pay
			let applePaySupported = false;
			try {
				applePaySupported = window.ApplePaySession && window.ApplePaySession.supportsVersion(3) && window.ApplePaySession.canMakePayments();
			} catch (e) {
				// Not supported or errored on attempt to check
			}

			let applePayPromise = Promise.resolve(null);
			if(applePaySupported) {
				applePayPromise = applePay.create({client: clientInstance}).catch(applePayErr => console.error('Error creating applePayInstance:', applePayErr));
			}

			return Promise.all([hostedFieldsPromise, applePayPromise]).then(([hostedFieldsInstance, applePayInstance]) => ({hostedFieldsInstance, applePayInstance}));
		})
		.then(purchaseFlowInit)
		.catch(e => {
			console.error('Braintree/Payments Error', e);

			// Throw to show the payments error message
			throw e;
		});
}

function setPromo() {
	const promoId = new URLSearchParams(location.search).get('promo');

	// Fetch the initial settings and products
	return !!promoId && fetch(`${API_HOST}/v1/promos/${promoId}`)
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

// Fetch the initial settings and products
Promise.all([
	fetch(API_HOST + `/v1/event-settings/${EVENT_2024_ID}`)
		.then(response => {
			if(!response.ok) throw new Error('Settings not loaded');

			return response;
		})
		.then(response => response.json()),
	fetch(API_HOST + `/v1/event-settings/${EVENT_2024_AFTERPARTY_ID}`)
		.then(response => {
			if(!response.ok) throw new Error('Afterparty Settings not loaded');

			return response;
		})
		.then(response => response.json())
])
	.then(evs => evs.forEach(({ products: siteProducts, ...ev }) => {
		siteProducts.forEach(p => products[p.id] = p);
		events[ev.id] = ev;
	}))
	.then(setPromo)
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
