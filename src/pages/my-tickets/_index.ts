import Swiper from 'swiper';
import { API_HOST } from 'astro:env/client';

const orderToken = new URLSearchParams(location.search).get('t'),
	handleError = (e: Error) => {
		// If anything errors, we need to show a message in the tickets section
		document.querySelector<HTMLElement>('main')!.innerHTML = `
			<h5 style="padding-top: 5em; color: #602a34; text-align: center">
				Something seems to be broken,<br>please refresh the page and try again
			</h5>
			<p>If the problem persists, please contact support at <a href="mailto:contact@mustachebash.com">contact@mustachebash.com</a></p>
		`;

		console.error(e);
	};

if(orderToken) {
	// Fetch the initial settings and products
	fetch(`${API_HOST}/v1/mytickets?t=${orderToken}`)
		.then(response => {
			if(!response.ok) throw new Error('Tickets not loaded');

			return response;
		})
		.then(response => (response.json() as Promise<{
			customer: Record<string, any>;
			tickets: Record<string, any>[];
		}>))
		.then(({customer, tickets}) => {
			if(!tickets.length) throw new Error('No tickets returned');

			const eventsById: Record<string, any> = {};

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
						timeString,
						tickets: []
					};
				}

				eventsById[eventId].tickets.push(ticket);
			});

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
							${tickets.map(({ qrCode, eventName, admissionTier }, i) => (`
								<div class="ticket swiper-slide">
									<div class="img-wrap ${!qrCode ? 'outline' : ''}">
										${qrCode ? `<img src="${qrCode}" />` : '<h5>Your Tickets will be shown here<br>closer to the event</h5>'}
									</div>
									<p>${eventName}${admissionTier === 'vip' ? ' &#128378;' : ''}</p>
									<p>${i + 1}/${tickets.length}</p>
								</div>
							`)).join('\n')}
						</div>
						<div class="swiper-pagination"></div>
						<div class="swiper-button-next"></div>
						<div class="swiper-button-prev"></div>
					</div>
				</div>
				<div class="tickets-list">
					<div class="container-1230">
						${/* eslint-disable indent*/
						Object.values(eventsById).map(({ name: eventName, dateString, timeString, tickets: eventTickets }) => `
							<div class="event-group">
								<div class="event-info">
									<h4>${eventName}</h4>
									<p>${dateString} at ${timeString}</p>
								</div>
								<ul>
								${[...eventTickets]
									.sort((a, b) =>  {
										// Rank by tier first
										if(a.admissionTier === 'vip' && b.admissionTier !== 'vip') return -1;
										if(a.admissionTier !== 'vip' && b.admissionTier === 'vip') return 1;

										return a.id > b.id ? 1 : -1;
									})
									.map((ticket, i) => {
										const { id, orderId, admissionTier } = ticket,
											ticketId = id.slice(0, 8),
											confirmationId = orderId.slice(0, 8);

										return `
											<li class="${admissionTier === 'vip' ? 'vip-tier' : 'general-tier'}">
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
													</div>
												</div>
											</li>
										`;
							/* eslint-enable */}).join('\n')}
								</ul>
							</div>
						`).join('\n')}
					</div>
				</div>
			`;

			document.querySelector<HTMLElement>('main')!.innerHTML = ticketsHTML;
		})
		.then(() => {
			try {
				const ticketSwiper = new Swiper(document.querySelector('.tickets'), {
					pagination: {
						el: '.swiper-pagination'
					},
					navigation: {
						nextEl: '.swiper-button-next',
						prevEl: '.swiper-button-prev'
					}
				});

				console.log('Swiper initialized', ticketSwiper);
			} catch(e) {
				console.error('Swiper intitionalization failed', e);

				document.querySelector<HTMLElement>('.tickets')!.classList.remove('swiper-container');
				document.querySelector<HTMLElement>('.tickets .swiper-wrapper')!.classList.remove('swiper-wrapper');
			}
		})
		.catch(handleError);
} else {
	// shouldn't land on this page without a transaction token
	handleError(new Error('No transaction token'));
}
