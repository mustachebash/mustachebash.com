import client from 'braintree-web/client';
import hostedFields, { type HostedFields } from 'braintree-web/hosted-fields';
import applePay, { ApplePaySession, type ApplePay } from 'braintree-web/apple-pay';
import { API_HOST, BRAINTREE_TOKEN } from 'astro:env/client';

import { format } from 'date-fns';

const EVENT_2025_ID = '0fe92cbb-a22c-4b25-993e-773ca016a5f1';
const EVENT_2025_AFTERPARTY_ID = 'f8b7a188-f9c7-48eb-bcb8-35462d76bb01';
const EVENT_2025_PREPARTY_ID = '533ba437-e2ba-472a-8180-b453dba5bb9f';

function logError({ lineno, colno, message, filename, stack, name }: { lineno: number, colno: number, message: string, filename: string, stack: string, name: string }) {
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
const customer: Record<string, any> = {},
	products: Record<string, any> = {},
	events: Record<string, any> = {};

let cart: Record<string, any>[] = [],
	promo: Record<string, any>;

// Requires tickets section
// Never allow this form to submit
((document.forms as any)['payment-info'] as HTMLFormElement).addEventListener('submit', e => {
	e.preventDefault();
});

// Requires tickets section
// Never allow this form to submit
((document.forms as any)['personal-info'] as HTMLFormElement).addEventListener('submit', e => {
	e.preventDefault();
});

function updateSubtotals() {
	const subtotal = cart.reduce((tot, cur) => tot + (cur.quantity * products[cur.productId].price), 0),
		orderSummaryList = document.querySelector<HTMLDListElement>('.order-summary dl') as HTMLDListElement;

	document.querySelector<HTMLSpanElement>('#grand-total span')!.innerText = subtotal.toFixed(2);

	orderSummaryList.innerHTML = '';

	cart.forEach(i => {
		const product = products[i.productId];

		orderSummaryList.innerHTML += `
			<dt>${product.name} (<span class="quantity">${i.quantity}</span>)</dt>
			<dd>$<span class="subtotal">${i.quantity * product.price}</span></dd>
		`;
	});
}

const quantityControls = document.querySelector('.quantity-controls') as HTMLDivElement;
function updateCartQuantities() {
	cart = [];
	quantityControls.querySelectorAll<HTMLSelectElement>('.ticket select').forEach(el => {
		const qty = Number(el.value);
		if(qty) {
			cart.push({
				productId: el.name.replace('-quantity', ''),
				quantity: qty
			});
		}
	});

	if(!cart.length) {
		document.querySelector<HTMLButtonElement>('#confirm-quantity')!.disabled = true;
	} else {
		document.querySelector<HTMLButtonElement>('#confirm-quantity')!.disabled = false;
	}

	updateSubtotals();
}

const targetGuestId = (new URLSearchParams(location.search).get('targetGuestId')) ?? undefined;
function completePurchase(nonce: string) {
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
				const err: Error & {status?: number} = new Error(response.statusText);

				err.status = response.status;

				throw err;
			}

			return Promise.all([response.headers, response.json()]);
		})
		.then(([ headers, { confirmationId, orderId, token } ]) => {
			window.requestAnimationFrame(() => {
				// In case Apple Pay takes us here
				document.querySelectorAll('.step')[2]!.classList.remove('active');
				document.querySelectorAll('.step')[3]!.classList.remove('active');
				document.querySelectorAll('.step')[4]!.classList.add('active');

				document.querySelector<HTMLSpanElement>('.confirmation-number span')!.innerText = `#${confirmationId}`;
				document.querySelector<HTMLSpanElement>('.order-number span')!.innerText = `#${orderId.slice(0, 8)}`;

				if(targetGuestId) {
					document.querySelector<HTMLAnchorElement>('.tickets-link a')!.style.display = 'none';
					// eslint-disable-next-line max-len
					document.querySelector<HTMLParagraphElement>('.confirmation-message')!.innerText = 'Thanks for purchasing a VIP upgrade! Your tickets have been upgraded. Use the link sent in your original purchase to access your tickets.';
				} else {
					document.querySelector<HTMLAnchorElement>('.tickets-link a')!.href = `/my-tickets?t=${token}`;
				}

				const tick = document.querySelectorAll<HTMLDivElement>('.ticks > div')[3];
				tick!.classList.remove('active');
				tick!.classList.add('complete');
			});

			const total = cart.reduce((tot, cur) => tot + (cur.quantity * products[cur.productId].price), 0),
				transactionId = headers?.get('Location')?.split('/').pop();
			try {
				window.gtag?.('event', 'purchase', {
					currency: 'USD',
					value: total,
					transaction_id: transactionId,
					items: cart.map(i => ({
						item_id: i.productId,
						item_name: products[i.productId].name,
						item_category: 'Tickets',
						item_variant: products[i.productId].admissionTier,
						price: String(products[i.productId].price),
						quantity: i.quantity
					}))
				});

				window.gtag?.('event', 'conversion', {
					send_to: 'AW-704569520/g7y6CKfiiboBELDB-88C',
					currency: 'USD',
					value: total,
					transaction_id: transactionId
				});
			} catch(e) {
				// Don't let gtag break the site
			}

			try {
				window.fbq('track', 'Purchase', {
					currency: 'USD',
					value: total,
					contents: cart.map(i => ({
						id: i.productId,
						quantity: i.quantity,
						item_price: Number(products[i.productId].price)
					}))
				});
			} catch(e) {
				// Don't let FB break the site
			}
		});
}

function purchaseFlowInit({hostedFieldsInstance, applePayInstance}: {hostedFieldsInstance: HostedFields, applePayInstance: ApplePay | null}) {
	const ticketsList = document.querySelector<HTMLDivElement>('#tickets-list') as HTMLDivElement,
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
								<option selected value="0">0</option>
								<option value="1">1</option>
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
			document.querySelector<HTMLDivElement>('.ticket-image')!.style.display = 'none';
			document.querySelector<HTMLDivElement>('.tickets-flow')!.innerHTML = `
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
			quantityControls.addEventListener('change', (e) => {
				try {
					const el = e.target as HTMLSelectElement;
					const newQty = Number(el.value);
					const productId = el.name.replace('-quantity', '');
					const prevQty = cart.find(i => i.productId === productId)?.quantity || 0;
					const qtyDiff = newQty - prevQty;
					if(qtyDiff > 0) {
						window.gtag?.('event', 'add_to_cart', {
							currency: 'USD',
							value: products[productId].price * qtyDiff,
							items: [{
								item_id: productId,
								item_name: products[productId].name,
								item_category: 'Tickets',
								item_variant: products[productId].admissionTier,
								price: products[productId].price,
								quantity: qtyDiff
							}]
						});
					} else if(qtyDiff < 0) {
						window.gtag?.('event', 'remove_from_cart', {
							currency: 'USD',
							value: Math.abs(products[productId].price * qtyDiff),
							items: [{
								item_id: productId,
								item_name: products[productId].name,
								item_category: 'Tickets',
								item_variant: products[productId].admissionTier,
								price: products[productId].price,
								quantity: qtyDiff
							}]
						});
					}
				} catch(e) {
					// Don't let gtag break the site
				}

				updateCartQuantities();
			});
		} else {
			document.querySelector<HTMLDivElement>('.ticket-image')!.style.display = 'none';
			document.querySelector<HTMLDivElement>('.tickets-flow')!.innerHTML = `
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
			document.querySelector<HTMLDivElement>('.apple-pay')!.style.display = 'block';
			document.querySelector<HTMLDivElement>('.apple-pay-button')!.addEventListener('click', () => {
				window.gtag?.('event', 'click', {
					event_category: 'CTA',
					event_label: 'Apple Pay'
				});

				// "Advance" the UI
				window.requestAnimationFrame(() => {
					const ticks = document.querySelectorAll<HTMLDivElement>('.ticks > div');
					ticks[2]!.classList.remove('active');
					ticks[2]!.classList.add('complete');
					ticks[3]!.classList.add('active');
					document.querySelectorAll<HTMLDivElement>('.leg')[2]!.classList.add('active');
				});

				// This is kinda funky, but people are basically getting to the "review" step here
				try {
					window.gtag?.('event', 'view_cart', {
						currency: 'USD',
						value: cart.reduce((tot, cur) => tot + (cur.quantity * products[cur.productId].price), 0),
						items: cart.map(i => ({
							item_id: i.productId,
							item_name: products[i.productId].name,
							item_category: 'Tickets',
							item_variant: products[i.productId].admissionTier,
							price: String(products[i.productId].price),
							quantity: i.quantity
						}))
					});
				} catch(e) {
					// Don't let gtag break the site
				}

				const paymentRequest = applePayInstance.createPaymentRequest({
						total: {
							label: 'Total (All sales final)',
							amount: String(cart.reduce((tot, cur) => tot + (cur.quantity * products[cur.productId].price), 0))
						},
						lineItems: cart.map(i => ({
							label: `${products[i.productId].name} (${i.quantity} qty)`,
							type: 'final',
							amount: String(products[i.productId].price * i.quantity)
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
					appleSession = new (window as any).ApplePaySession(3, paymentRequest) as ApplePaySession;

				appleSession.onvalidatemerchant = event => {
					applePayInstance.performValidation({validationURL: event.validationURL, displayName: 'Mustache Bash'})
						.then(merchantSession => appleSession.completeMerchantValidation(merchantSession))
						.catch(err => {
							appleSession.abort();
							console.error(err);

							// Revert the UI
							window.requestAnimationFrame(() => {
								const ticks = document.querySelectorAll<HTMLDivElement>('.ticks > div');
								ticks[2]!.classList.add('active');
								ticks[2]!.classList.remove('complete');
								ticks[3]!.classList.remove('active');
								document.querySelectorAll('.leg')[2]!.classList.remove('active');
							});
						});
				};

				appleSession.onpaymentauthorized = event => {
					applePayInstance.tokenize({token: event.payment.token})
						.then(payload => {
							console.log(JSON.stringify(event.payment));

							try {
								window.gtag?.('event', 'add_payment_info', {
									currency: 'USD',
									value: cart.reduce((tot, cur) => tot + (cur.quantity * products[cur.productId].price), 0),
									payment_type: 'Credit Card',
									items: cart.map(i => ({
										item_id: i.productId,
										item_name: products[i.productId].name,
										item_category: 'Tickets',
										item_variant: products[i.productId].admissionTier,
										price: String(products[i.productId].price),
										quantity: i.quantity
									}))
								});
							} catch(e) {
								// Don't let gtag break the site
							}

							// After you have transacted with the payload.nonce,
							// call `completePayment` to dismiss the Apple Pay sheet.
							// appleSession.completePayment(window.ApplePaySession.STATUS_SUCCESS);

							return payload.nonce;
						})
						.then(completePurchase)
						.then(() => appleSession.completePayment((window as any).ApplePaySession.STATUS_SUCCESS))
						.catch(e => {
							appleSession.completePayment((window as any).ApplePaySession.STATUS_FAILURE);

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
		document.querySelector<HTMLButtonElement>('#confirm-quantity')!.addEventListener('click', () => {
			// Make sure there's items in the cart to purchase
			const valid = cart.length;

			if(valid) {
				window.requestAnimationFrame(() => {
					document.querySelectorAll<HTMLDivElement>('.step')[0]!.classList.remove('active');
					document.querySelectorAll<HTMLDivElement>('.step')[1]!.classList.add('active');

					const ticks = document.querySelectorAll<HTMLDivElement>('.ticks > div');
					ticks[0]!.classList.remove('active');
					ticks[0]!.classList.add('complete');
					ticks[1]!.classList.add('active');
					document.querySelectorAll<HTMLDivElement>('.leg')[0]!.classList.add('active');
				});

				try {
					window.gtag?.('event', 'begin_checkout', {
						currency: 'USD',
						value: cart.reduce((tot, cur) => tot + (cur.quantity * products[cur.productId].price), 0),
						items: cart.map(i => ({
							item_id: i.productId,
							item_name: products[i.productId].name,
							item_category: 'Tickets',
							item_variant: products[i.productId].admissionTier,
							price: String(products[i.productId].price),
							quantity: i.quantity
						}))
					});
				} catch(e) {
					// Don't let gtag break the site
				}
			}
		});
	} else if(promo.type === 'single-use') {
		cart.push({
			productId: promo.product.id,
			quantity: promo.productQuantity
		});

		const steps = document.querySelector<HTMLDivElement>('.steps') as HTMLDivElement,
			promoInfo = document.createElement('h5');

		promoInfo.innerHTML = `Promo Ticket: ${promo.product.name} - $${promo.price}/ea (${promo.productQuantity} qty)`;

		steps.parentNode!.insertBefore(promoInfo, steps);

		const subtotal = promo.price * promo.productQuantity,
			orderSummaryList = document.querySelector<HTMLDListElement>('.order-summary dl') as HTMLDListElement;

		document.querySelector<HTMLSpanElement>('#grand-total span')!.innerText = String(subtotal);

		orderSummaryList.innerHTML = `
			<dt>${promo.product.name} (<span class="quantity">${promo.productQuantity}</span>)</dt>
			<dd>$<span class="subtotal">${subtotal}</span></dd>
		`;

		window.requestAnimationFrame(() => {
			document.querySelectorAll<HTMLDivElement>('.step')[0]!.classList.remove('active');
			document.querySelectorAll<HTMLDivElement>('.step')[1]!.classList.add('active');

			const ticks = document.querySelectorAll<HTMLDivElement>('.ticks > div');
			ticks[0]!.classList.remove('active');
			ticks[0]!.classList.add('complete');
			ticks[1]!.classList.add('active');
			document.querySelectorAll<HTMLDivElement>('.leg')[0]!.classList.add('active');
		});
	}

	// Step 2
	document.querySelector<HTMLButtonElement>('#enter-personal-info')!.addEventListener('click', () => {
		// Let's get ridiculous so we can check
		let nameValid = false,
			emailValid = false;

		const fullName = document.querySelector<HTMLInputElement>('input[name="name"]')!.value,
			email = document.querySelector<HTMLInputElement>('input[name="email"]')!.value;

		// Not much name validation - your bad if you put in a fake name for a guest list
		if(!fullName || fullName.trim().split(' ').length < 2) {
			// redundant here, but done for explicitness
			nameValid = false;
			document.querySelector<HTMLFieldSetElement>('fieldset[name="name"]')!.classList.add('invalid');
		} else {
			nameValid = true;
			document.querySelector<HTMLFieldSetElement>('fieldset[name="name"]')!.classList.remove('invalid');
		}

		// There's no such thing as a simple email validator - but again, your bad if you put in a shit email for confirmation
		if(!email || !/^\S+@\S+\.\S{2,}$/.test(email.trim())) {
			emailValid = false;
			document.querySelector<HTMLFieldSetElement>('fieldset[name="email"]')!.classList.add('invalid');
		} else {
			emailValid = true;
			document.querySelector<HTMLFieldSetElement>('fieldset[name="email"]')!.classList.remove('invalid');
		}

		if(nameValid && emailValid) {
			customer.email = email.trim();
			customer.firstName = fullName.trim().split(' ')[0];
			customer.lastName = fullName.trim().split(' ').slice(1).join(' ');
			customer.marketingOptIn = document.querySelector<HTMLInputElement>('input[name="marketing-opt-in"]')!.checked;

			document.querySelector<HTMLSpanElement>('.reservation-details-name')!.innerText = fullName.trim();
			document.querySelector<HTMLSpanElement>('.reservation-details-email')!.innerText = email.trim();

			window.requestAnimationFrame(() => {
				document.querySelectorAll<HTMLDivElement>('.step')[1]!.classList.remove('active');
				document.querySelectorAll<HTMLDivElement>('.step')[2]!.classList.add('active');

				const ticks = document.querySelectorAll<HTMLDivElement>('.ticks > div');
				ticks[1]!.classList.remove('active');
				ticks[1]!.classList.add('complete');
				ticks[2]!.classList.add('active');
				document.querySelectorAll<HTMLDivElement>('.leg')[1]!.classList.add('active');
			});

			// TODO: this should be 'generate_lead' in GA4, but we should also submit the contact info to Mailchimp for retargeting if they don't complete checkout
		}
	});

	// Step 3
	document.querySelector<HTMLButtonElement>('#enter-payment-info')!.addEventListener('click', () => {
		let paymentValid = false;

		const state = hostedFieldsInstance.getState();

		// Check the braintree fields with this slick copy/paste job they provided
		paymentValid = Object.keys(state.fields).every(key => ((state.fields as any)[key].isValid));


		if(paymentValid) {
			window.requestAnimationFrame(() => {
				document.querySelectorAll<HTMLDivElement>('.step')[2]!.classList.remove('active');
				document.querySelectorAll<HTMLDivElement>('.step')[3]!.classList.add('active');

				// Even though this fires effectively when the user submits payment option, it's in line with the user immediately being shown the cart subtotals
				try {
					window.gtag?.('event', 'view_cart', {
						currency: 'USD',
						value: cart.reduce((tot, cur) => tot + (cur.quantity * products[cur.productId].price), 0),
						items: cart.map(i => ({
							item_id: i.productId,
							item_name: products[i.productId].name,
							item_category: 'Tickets',
							item_variant: products[i.productId].admissionTier,
							price: String(products[i.productId].price),
							quantity: i.quantity
						}))
					});
				} catch(e) {
					// Don't let gtag break the site
				}

				const ticks = document.querySelectorAll<HTMLDivElement>('.ticks > div');
				ticks[2]!.classList.remove('active');
				ticks[2]!.classList.add('complete');
				ticks[3]!.classList.add('active');
				document.querySelectorAll<HTMLDivElement>('.leg')[2]!.classList.add('active');
			});

			try {
				window.gtag?.('event', 'add_payment_info', {
					currency: 'USD',
					value: cart.reduce((tot, cur) => tot + (cur.quantity * products[cur.productId].price), 0),
					payment_type: 'Credit Card',
					items: cart.map(i => ({
						item_id: i.productId,
						item_name: products[i.productId].name,
						item_category: 'Tickets',
						item_variant: products[i.productId].admissionTier,
						price: String(products[i.productId].price),
						quantity: i.quantity
					}))
				});
			} catch(e) {
				// Don't let gtag break the site
			}
		}
	});

	if(!promo) {
		document.querySelector<HTMLButtonElement>('#back-to-quantity')!.addEventListener('click', e => {
			e.preventDefault();
			window.requestAnimationFrame(() => {
				document.querySelectorAll<HTMLDivElement>('.step')[1]!.classList.remove('active');
				document.querySelectorAll<HTMLDivElement>('.step')[0]!.classList.add('active');

				const ticks = document.querySelectorAll<HTMLDivElement>('.ticks > div');
				ticks[1]!.classList.remove('active');
				ticks[0]!.classList.remove('complete');
				ticks[0]!.classList.add('active');
				document.querySelectorAll<HTMLDivElement>('.leg')[0]!.classList.remove('active');
			});
		});
	} else {
		document.querySelector<HTMLDivElement>('#back-to-quantity')!.remove();
	}

	document.querySelector<HTMLButtonElement>('#back-to-personal')!.addEventListener('click', e => {
		e.preventDefault();
		window.requestAnimationFrame(() => {
			document.querySelectorAll<HTMLDivElement>('.step')[2]!.classList.remove('active');
			document.querySelectorAll<HTMLDivElement>('.step')[1]!.classList.add('active');

			const ticks = document.querySelectorAll<HTMLDivElement>('.ticks > div');
			ticks[2]!.classList.remove('active');
			ticks[1]!.classList.remove('complete');
			ticks[1]!.classList.add('active');
			document.querySelectorAll<HTMLDivElement>('.leg')[1]!.classList.remove('active');
		});
	});

	// Step 4
	let submitting = false;
	document.querySelector<HTMLButtonElement>('#confirm-order')!.addEventListener('click', () => {
		// Cool it, cowboy
		if(submitting) return;

		submitting = true;
		document.querySelector<HTMLButtonElement>('#confirm-order')!.innerText = 'Processing...';
		document.querySelector<HTMLButtonElement>('#confirm-order')!.disabled = true;
		document.querySelector<HTMLAnchorElement>('#back-to-payment')!.style.display = 'none';

		try {
			window.gtag?.('event', 'confirm_cart');
		} catch(e) {
			// Don't let gtag break the site
		}

		hostedFieldsInstance.tokenize({cardholderName: `${customer.firstName} ${customer.lastName}`})
			.then(({ nonce }) => completePurchase(nonce))
			.catch(e => {
				submitting = false;
				document.querySelector<HTMLButtonElement>('#confirm-order')!.innerText = 'Purchase';
				document.querySelector<HTMLButtonElement>('#confirm-order')!.disabled = false;
				document.querySelector<HTMLAnchorElement>('#back-to-payment')!.style.display = '';

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

	document.querySelector<HTMLAnchorElement>('#back-to-payment')!.addEventListener('click', e => {
		// Can't go back now
		if(submitting) return;

		e.preventDefault();
		window.requestAnimationFrame(() => {
			document.querySelectorAll<HTMLDivElement>('.step')[3]!.classList.remove('active');
			document.querySelectorAll<HTMLDivElement>('.step')[2]!.classList.add('active');

			const ticks = document.querySelectorAll<HTMLDivElement>('.ticks > div');
			ticks[3]!.classList.remove('active');
			ticks[2]!.classList.remove('complete');
			ticks[2]!.classList.add('active');
			document.querySelectorAll<HTMLDivElement>('.leg')[2]!.classList.remove('active');
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
				applePaySupported = (window as any).ApplePaySession && (window as any).ApplePaySession.supportsVersion(3) && (window as any).ApplePaySession.canMakePayments();
			} catch (e) {
				console.error('Apple Pay Check Error', e);
				// Not supported or errored on attempt to check
			}

			let applePayPromise: Promise<null | ApplePay> = Promise.resolve(null);
			if(applePaySupported) {
				applePayPromise = applePay.create({client: clientInstance}).catch(applePayErr => console.error('Error creating applePayInstance:', applePayErr)) as Promise<ApplePay>;
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
				const err: Error & {status?: number} = new Error('Promo Error');

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

			document.querySelector<HTMLDivElement>('.tickets-flow')!.innerHTML = `<h5 style="padding-top: 5em; color: #e66a40; text-align: center">${promoMessage}</h5>`;
		});
}

type EventSettings = {
	id: string;
	name: string;
	date: string;
	openingSales: string;
	salesEnabled: boolean;
	meta: {
		ticketsOrder: string[];
		currentTicket: string;
	};
	products: {
		id: string;
		name: string;
		description: string;
		price: number;
		status: string;
		eventId: string;
		admissionTier: string;
		meta: {
			nextTierProductId?: string;
		};
	}[];
};
// Fetch the initial settings and products
Promise.all([
	fetch(API_HOST + `/v1/event-settings/${EVENT_2025_ID}`)
		.then(response => {
			if(!response.ok) throw new Error('Settings not loaded');

			return response;
		})
		.then(response => (response.json() as Promise<EventSettings>)),
	fetch(API_HOST + `/v1/event-settings/${EVENT_2025_AFTERPARTY_ID}`)
		.then(response => {
			if(!response.ok) throw new Error('Afterparty Settings not loaded');

			return response;
		})
		.then(response => (response.json() as Promise<EventSettings>)),
	fetch(API_HOST + `/v1/event-settings/${EVENT_2025_PREPARTY_ID}`)
		.then(response => {
			if(!response.ok) throw new Error('Preparty Settings not loaded');

			return response;
		})
		.then(response => (response.json() as Promise<EventSettings>))
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
		document.querySelector<HTMLDivElement>('.tickets-flow')!.innerHTML = '<h5 style="padding-top: 5em; color: #602a34; text-align: center">Something seems to be broken,<br>please refresh the page and try again</h5>';

		logError(e);
	});
