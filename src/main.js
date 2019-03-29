import 'normalize.css';
import 'main.less';

import url from 'url';
import client from 'braintree-web/client';
import hostedFields from 'braintree-web/hosted-fields';

// Set some state here
const cart = [],
	customer = {},
	availableProducts = {},
	pageSettings = {
		serviceFee: 3
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

		// Offset by 75px for the header
		const scrollPos = document.querySelector(e.target.hash).offsetTop - 90,
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
document.querySelector('#next-slide').addEventListener('click', () => {
	const currentSlide = document.querySelector('#slide-container .active'),
		nextSlide = currentSlide.nextElementSibling;

	if(nextSlide) {
		nextSlide.style.display = 'block';
		window.requestAnimationFrame(() => nextSlide.classList.add('active'));
	} else {
		const poster = document.querySelector('#slide-container .poster');
		poster.style.display = 'block';
		poster.classList.add('active');
	}

	currentSlide.classList.remove('active');
	setTimeout(() => currentSlide.style.display = 'none', 600);
});

document.querySelector('#prev-slide').addEventListener('click', () => {
	const currentSlide = document.querySelector('#slide-container .active'),
		prevSlide = currentSlide.previousElementSibling;

	if(prevSlide) {
		prevSlide.style.display = 'block';
		window.requestAnimationFrame(() => prevSlide.classList.add('active'));
	} else {
		const lastSlide = document.querySelector('#slide-container').lastElementChild;
		lastSlide.style.display = 'block';
		lastSlide.classList.add('active');
	}

	currentSlide.classList.remove('active');
	setTimeout(() => currentSlide.style.display = 'none', 600);
});

const gallerySize = window.innerWidth > 768 ? 'Desktop' : 'Mobile';
for (let i = 1; i < 9; i++) {
	const img = new Image();

	img.onload = () => document.querySelector(`.slide-${i}`).style.backgroundImage = `url('/img/gallery/Gallery_${gallerySize}_2019_${i}.jpg')`;

	img.src = `/img/gallery/Gallery_${gallerySize}_2019_${i}.jpg`;
}

// Never allow this form to submit
document.forms.purchase.addEventListener('submit', e => {
	e.preventDefault();
});

function updateSubtotals() {
	const quantity = cart.reduce((tot, cur) => tot + cur.quantity, 0),
		subtotal = cart.reduce((tot, cur) => tot + (cur.quantity * availableProducts[cur.productId].price), 0),
		feeTotal = quantity * pageSettings.serviceFee,
		orderSummaryList = document.querySelector('.order-summary dl');

	document.querySelector('#quantity-subtotal span').innerText = subtotal;
	document.querySelector('#grand-total span').innerText = subtotal + feeTotal;

	orderSummaryList.innerHTML = '';

	cart.forEach(i => {
		const product = availableProducts[i.productId];

		orderSummaryList.innerHTML += `
			<dt>${product.name} (<span class="quantity">${i.quantity}</span>)</dt>
			<dd>$<span class="subtotal">${i.quantity * product.price}</span></dd>
		`;
	});

	orderSummaryList.innerHTML += `
		<dt>Fees</dt>
		<dd>$<span class="subtotal">${feeTotal}</span></dd>
	`;
}

function addItemToCart(el) {
	const cartItemIndex = cart.findIndex(i => i.productId === el.dataset.productId);

	if(~cartItemIndex) {
		// 4 ticket max
		if(cart[cartItemIndex].quantity >= 4) return;

		cart[cartItemIndex].quantity++;

		if(cart[cartItemIndex].quantity === 4) el.querySelector('.plus').classList.add('disabled');

		el.querySelector('.quantity').innerText = cart[cartItemIndex].quantity;
		el.querySelector('.product-total span').innerText = availableProducts[el.dataset.productId].price * cart[cartItemIndex].quantity;
	} else {
		cart.push({
			productId: el.dataset.productId,
			quantity: 1
		});

		el.querySelector('.quantity').innerText = 1;
		el.querySelector('.product-total span').innerText = availableProducts[el.dataset.productId].price;
		el.querySelector('.minus').classList.remove('disabled');
	}

	updateSubtotals();
}

function removeItemFromCart(el) {
	const cartItemIndex = cart.findIndex(i => i.productId === el.dataset.productId);

	if(~cartItemIndex) {
		cart[cartItemIndex].quantity--;

		el.querySelector('.quantity').innerText = cart[cartItemIndex].quantity;
		el.querySelector('.plus').classList.remove('disabled');

		// If it's zero, remove the item entirely, otherwise update the subtotal
		if(!cart[cartItemIndex].quantity) {
			cart.splice(cartItemIndex, 1);
			el.querySelector('.product-total span').innerText = 0;
			el.querySelector('.minus').classList.add('disabled');
		} else {
			el.querySelector('.product-total span').innerText = availableProducts[el.dataset.productId].price * cart[cartItemIndex].quantity;
		}
	}

	updateSubtotals();
}

function purchaseFlowInit(hostedFieldsInstance) {
	if(!promo) {
		for(const id in availableProducts) {
			document.querySelectorAll(`[data-product-id="${id}"]`).forEach(el => el.classList.remove('disabled'));
		}

		// Preselect a ticket
		if (availableProducts['f9fc55b4-446c-477e-8eae-0599c065c0bc']) {
			addItemToCart(document.querySelector('.table-row[data-product-id="f9fc55b4-446c-477e-8eae-0599c065c0bc"]'));
		}

		// Add a ticket if someone clicks the afterparty CTA
		if (availableProducts['f9fc55b4-446c-477e-8eae-0599c065c0bc']) {
			document.querySelector('#afterparty-cta').addEventListener('click', () => {
				const cartItemIndex = cart.findIndex(i => i.productId === 'f9fc55b4-446c-477e-8eae-0599c065c0bc');
				if (!~cartItemIndex) {
					addItemToCart(document.querySelector('.table-row[data-product-id="f9fc55b4-446c-477e-8eae-0599c065c0bc"]'));
				}
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
								name: availableProducts[i.productId].name,
								category: 'Tickets',
								price: String(availableProducts[i.productId].price)
							}))
						});
					} catch(e) {
						// Don't let gtag break the site
					}
				}
			}
		});
	} else if(promo.type === 'single-use'){
		cart.push({
			productId: promo.product.id,
			quantity: 1
		});

		const steps = document.querySelector('.steps'),
			promoInfo = document.createElement('h5');

		promoInfo.innerHTML = `Promo Ticket: ${promo.product.name} - $${promo.price}<br>${promo.product.description}`;

		steps.parentNode.insertBefore(promoInfo, steps);

		const subtotal = promo.price,
			feeTotal = pageSettings.serviceFee,
			orderSummaryList = document.querySelector('.order-summary dl');

		document.querySelector('#quantity-subtotal span').innerText = subtotal;
		document.querySelector('#grand-total span').innerText = subtotal + feeTotal;

		orderSummaryList.innerHTML = `
			<dt>${promo.product.name} (<span class="quantity">1</span>)</dt>
			<dd>$<span class="subtotal">${subtotal}</span></dd>
			<dt>Fees</dt>
			<dd>$<span class="subtotal">${feeTotal}</span></dd>
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

	// Donation
	document.querySelector('#donate-derek').addEventListener('change', () => {
		const donateCheckbox = document.querySelector('#donate-derek'),
			currentTotal = Number(document.querySelector('#grand-total span').innerText);

		if(donateCheckbox.checked) {
			document.querySelector('#grand-total span').innerText = currentTotal + Number(donateCheckbox.value);
		} else {
			updateSubtotals();
		}
	});

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
							name: availableProducts[i.productId].name,
							category: 'Tickets',
							price: String(availableProducts[i.productId].price)
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
						name: availableProducts[i.productId].name,
						category: 'Tickets',
						price: String(availableProducts[i.productId].price)
					}))
				});
			} catch(e) {
				// Don't let gtag break the site
			}
		}

		hostedFieldsInstance.tokenize()
			.then(({ nonce }) => fetch(API_HOST + '/v1/transactions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					paymentMethodNonce: nonce,
					customer,
					cart,
					promoId: promo && promo.id,
					donation: document.querySelector('#donate-derek').checked
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
			.then(([ headers, confirmation ]) => {
				window.requestAnimationFrame(() => {
					document.querySelectorAll('.step')[2].classList.remove('active');
					document.querySelectorAll('.step')[3].classList.add('active');

					document.querySelector('.confirmation-number span').innerText = confirmation;

					const tick = document.querySelectorAll('.ticks > div')[2];
					tick.classList.remove('active');
					tick.classList.add('complete');
				});

				if(typeof window.gtag === 'function') {
					try {
						const quantity = cart.reduce((tot, cur) => tot + cur.quantity, 0),
							subtotal = cart.reduce((tot, cur) => tot + (cur.quantity * availableProducts[cur.productId].price), 0),
							feeTotal = quantity * pageSettings.serviceFee;

						window.gtag('event', 'purchase', {
							transaction_id: headers.get('Location').split('/').pop(),
							value: subtotal + feeTotal,
							currency: 'USD',
							checkout_step: 4,
							items: cart.map(i => ({
								id: i.productId,
								quantity: i.quantity,
								name: availableProducts[i.productId].name,
								category: 'Tickets',
								price: String(availableProducts[i.productId].price)
							}))
						});
					} catch(e) {
						// Don't let gtag break the site
					}
				}

				if(typeof window.fbq === 'function') {
					try {
						const quantity = cart.reduce((tot, cur) => tot + cur.quantity, 0),
							subtotal = cart.reduce((tot, cur) => tot + (cur.quantity * availableProducts[cur.productId].price), 0),
							feeTotal = quantity * pageSettings.serviceFee;

						window.fbq('track', 'Purchase', {
							value: subtotal + feeTotal,
							currency: 'USD',
							contents: cart.map(i => ({
								id: i.productId,
								quantity: i.quantity,
								item_price: Number(availableProducts[i.productId].price)
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

	if(!promo) {
		// Quantity controls
		document.querySelectorAll('.plus').forEach(plus => plus.addEventListener('click', e => {
			if(e.currentTarget.classList.contains('disabled')) return;
			if(e.currentTarget.parentElement.parentElement.classList.contains('disabled')) return;

			// Increment based on product row data
			addItemToCart(e.currentTarget.parentElement.parentElement);
		}));

		document.querySelectorAll('.minus').forEach(minus => minus.addEventListener('click', e => {
			if(e.currentTarget.classList.contains('disabled')) return;
			if(e.currentTarget.parentElement.parentElement.classList.contains('disabled')) return;

			// Decrement
			removeItemFromCart(e.currentTarget.parentElement.parentElement);
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
					color: '#643a17'
				},
				'.invalid': {
					color: '#e25740'
				},
				':focus': {
					outline: 0
				},
				'::placeholder': {
					color: 'rgba(100,58,23,.5)'
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
		.then(siteSettings => {
			siteSettings.products.forEach(p => availableProducts[p.id] = p);
			Object.assign(pageSettings, siteSettings.settings);
		})
		.catch(e => {
			console.error('Settings Error', e);

			throw e;
		})
		.then(braintreeInit)
		.catch(() => {
			// If anything errors, we need to show a message in the tickets section
			// eslint-disable-next-line max-len
			document.querySelector('.tickets-flow').innerHTML = '<h5 style="padding-top: 5em; color: #e66a40; text-align: center">Something seems to be broken,<br>please refresh the page and try again</h5>';
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
