import 'normalize.css';
import 'swiper/less';
import 'mytickets.less';

import Swiper from 'swiper';
import qrcode from 'qrcode';

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

const orderToken = new URLSearchParams(location.search).get('t'),
	handleError = e => {
		// If anything errors, we need to show a message in the tickets section
		document.querySelector('main').innerHTML = `
			<h5 style="padding-top: 5em; color: #602a34; text-align: center">
				Something seems to be broken,<br>please refresh the page and try again
			</h5>
			<p>If the problem persists, please contact support at <a href="mailto:contact@mustachebash.com">contact@mustachebash.com</a></p>
		`;

		logError(e);
	};

function ticketSort(a, b) {
	// Rank by tier first
	if(a.admissionTier === 'vip' && b.admissionTier !== 'vip') return -1;
	if(a.admissionTier !== 'vip' && b.admissionTier === 'vip') return 1;

	return a.id > b.id ? 1 : -1;
}

if(orderToken) {
	// Fetch the initial settings and products
	fetch(`${API_HOST}/v1/mytickets?t=${orderToken}`)
		.then(response => {
			if(!response.ok) throw new Error('Tickets not loaded');

			return response;
		})
		.then(response => response.json())
		.then(async ({customer, tickets}) => {
			if(!tickets.length) throw new Error('No tickets returned');

			const ticketQRCodes = await Promise.all(tickets.map(async ({ id, qrPayload }) => {
				if(!qrPayload) return {id, qrImg: null};

				try {
					const qrImg = await qrcode.toDataURL(qrPayload, { scale: 8, errorCorrectionLevel: 'M' });

					return {id, qrImg};
				} catch(e) {
					console.error('QR code generation failed', e);
					return {id, qrImg: null};
				}
			}));

			const ticketQRCodesById = ticketQRCodes.reduce((acc, {id, qrImg}) => {
				acc[id] = qrImg;
				return acc;
			}, {});

			return {customer, tickets, ticketQRCodesById};
		})
		.then(({customer, tickets, ticketQRCodesById}) => {
			const eventsById = {};

			tickets.forEach(ticket => {
				const { eventId, eventName, eventDate } = ticket;
				if(!eventsById[eventId]) {
					const eventDateObj = new Date(eventDate);

					const dateString = eventDateObj.toLocaleDateString('en-US', {
							weekday: 'long',
							year: 'numeric',
							month: 'long',
							day: 'numeric'
						}),
						timeString = eventDateObj.toLocaleTimeString('en-US', {
							hour: 'numeric',
							minute: 'numeric',
							hour12: true
						});

					eventsById[eventId] = {
						id: eventId,
						name: eventName,
						dateString,
						timeString
					};
				}
			});

			const eventsOrder = Object.values(eventsById).sort((a, b) => {
				const aDate = new Date(a.eventDate),
					bDate = new Date(b.eventDate);

				return aDate - bDate;
			}).map(event => event.id);

			// TODO: loop the tickets for QR codes, but display each guest as a row and tier below
			const { firstName, lastName, email } = customer;

			const ticketsHTML = `
				<div class="container-1230">
					<h4>Active tickets</h4>
					<h3>${firstName} ${lastName}</h3>
					<h2>${email}</h2>
					<p class="download-wallet">
						<!-- <a class="wallet" href="#"><img src="./img/apple-wallet.svg" /></a> -->
					</p>
					<p class="disclaimer">
						This is event is 21+ only. All guests must have a valid ID and ticket to check in. Do not share this link
						with anyone.<!-- If you have any additional questions, please <a href="/info" target="_blank">visit our FAQs</a>.-->
					</p>
					<p class="instructions">
						Swipe to scan different tickets.<br class="mobile-only" /> Scroll down for more ticket details.
					</p>
					<div class="tickets swiper-container">
						<div class="swiper-wrapper">
							${/* eslint-disable indent*/
							eventsOrder.flatMap(orderedEventId => tickets
								.filter(({ eventId }) => eventId === orderedEventId)
								.sort(ticketSort)
								.map(({ id, admissionTier, status }, i, arr) => (`
								<div class="ticket swiper-slide">
									<div class="img-wrap ${!ticketQRCodesById[id] ? 'outline' : ''}">
										${ticketQRCodesById[id] ? `<img src="${ticketQRCodesById[id]}" />` : '<h5>Your Tickets will be shown here<br>closer to the event</h5>'}
										${ticketQRCodesById[id] && status === 'checked_in' ? `<div class="checked-in"><span>Checked In</span></div>` : ''}
									</div>
									<p>${eventsById[orderedEventId].name}${admissionTier === 'vip' ? ' &#128378;' : ''}</p>
									<p>${i + 1}/${arr.length}</p>
								</div>
							`)).join('\n'))}
						</div>
						<div class="swiper-pagination"></div>
						<div class="swiper-button-next"></div>
						<div class="swiper-button-prev"></div>
					</div>
				</div>
				<div class="tickets-list">
					<div class="container-1230">
						${/* eslint-disable indent*/
						eventsOrder.map((orderedEventId) => {
							const { name: eventName, dateString, timeString } = eventsById[orderedEventId],
								eventTickets = tickets.filter(({ eventId }) => eventId === orderedEventId);

							return `
								<div class="event-group">
									<div class="event-info">
										<h4>${eventName}</h4>
										<p>${dateString} at ${timeString}</p>
									</div>
									<ul>
									${[...eventTickets]
										.sort(ticketSort)
										.map((ticket, i) => {
											const { id, orderId, admissionTier, status, checkInTime } = ticket,
												ticketId = id.slice(0, 8),
												confirmationId = orderId.slice(0, 8);

											return `
												<li class="${admissionTier === 'vip' ? 'vip-tier' : 'general-tier'} ${status === 'checked_in' ? 'checked-in' : ''}">
													<div class="info">
														<div class="ticket-number">
															<h2>#${i + 1}</h2>
														</div>
														<div class="ticket-tier">
															<h5>${admissionTier === 'vip'
																	? 'VIP &#128378;'
																	: window.innerWidth > 420
																		? 'General Admission'
																		: 'GA'
															}</h5>
														</div>
														<div class="ticket-ids">
															<p>Ticket #${ticketId}</p>
															<p>Confirmation #${confirmationId}</p>
															${status === 'checked_in' ? `<p>Checked In: ${(new Date(checkInTime)).toLocaleTimeString('en-US', {hour: 'numeric', minute: 'numeric', hour12: true})}</p>` : ''}
														</div>
													</div>
												</li>
											`;
										}).join('\n')}
									</ul>
								</div>
							`;
						/* eslint-enable */}).join('\n')}
					</div>
				</div>
			`;

			document.querySelector('main').innerHTML = ticketsHTML;
		})
		.then(() => {
			try {
				// eslint-disable-next-line no-unused-vars
				const ticketSwiper = new Swiper(document.querySelector('.tickets'), {
					pagination: {
						el: '.swiper-pagination'
					},
					navigation: {
						nextEl: '.swiper-button-next',
						prevEl: '.swiper-button-prev'
					}
				});
			} catch(e) {
				console.error('Swiper intitionalization failed', e);

				document.querySelector('.tickets').classList.remove('swiper-container');
				document.querySelector('.tickets .swiper-wrapper').classList.remove('swiper-wrapper');
			}
		})
		.catch(handleError);
} else {
	// shouldn't land on this page without a transaction token
	handleError(new Error('No transaction token'));
}
