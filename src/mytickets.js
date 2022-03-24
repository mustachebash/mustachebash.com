import 'normalize.css';
import 'swiper/less';
import 'mytickets.less';

import url from 'url';
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

const { t: transactionToken } = url.parse(location.href, true).query,
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

if(transactionToken) {
	// Fetch the initial settings and products
	fetch(`${API_HOST}/v1/mytickets?t=${transactionToken}`)
		.then(response => {
			if(!response.ok) throw new Error('Tickets not loaded');

			return response;
		})
		.then(response => response.json())
		.then(tickets => {
			if(!tickets.length) throw new Error('No tickets returned');

			// FIXME: This isn't ideal, but works with our system
			// This only works with "Guest #" suffixes added to guest names.
			tickets.sort((a, b) => {
				if(a.eventDate > b.eventDate) return 1;
				if(a.eventDate < b.eventDate) return -1;

				return a.lastName > b.lastName ? 1 : -1;
			});

			const { confirmationId, firstName, lastName, eventName, eventDate } = tickets[0],
				eventDateObj = new Date(eventDate);

			// Gets a UTC time, hardcode the PDT offset
			eventDateObj.setUTCHours(eventDateObj.getUTCHours() - 8);

			const dateString = eventDateObj.toLocaleDateString('en-US', {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
					timeZone: 'UTC'
				}),
				eventHour = eventDateObj.getUTCHours() > 12 ? eventDateObj.getUTCHours() - 12 : eventDateObj.getUTCHours(),
				eventMinutes = `${eventDateObj.getUTCMinutes() < 10 ? `0${eventDateObj.getUTCMinutes()}` : eventDateObj.getUTCMinutes()}`,
				eventPeriod = eventDateObj.getUTCHours() >= 12 ? 'pm' : 'am',
				// eslint-disable-next-line max-len
				timeString = `${eventHour}:${eventMinutes}${eventPeriod}`;

			const ticketsHTML = `
				<h1>Your tickets</h1>
				<h2>Order #${confirmationId}</h2>
				<h2>Purchased by ${firstName} ${lastName}</h2>
				<h4>${eventName}</h4>
				<h4>${dateString}</h4>
				<h4>Doors at ${timeString}</h4>
				<p class="download-wallet">
					<a class="download" href="${API_HOST}/v1/mytickets/pdf?t=${transactionToken}">Download PDF</a>
					<!-- <a class="wallet" href="#"><img src="./img/apple-wallet.svg" /></a> -->
				</p>
				<p class="disclaimer">
					This is event is 21+ only, no re-entry. All guests must have a valid ID and ticket at the door. Do not share your tickets with
					anyone you do not trust. If you have any additional questions, please <a href="/#faq" target="_blank">visit our FAQs</a>.
				</p>
				<div class="tickets swiper-container">
					<div class="swiper-wrapper">
						${tickets.map(({ qrCode, eventName, vip }, i) => (`
							<div class="ticket swiper-slide">
								<div class="img-wrap">
									<img src="${qrCode}" />
								</div>
								<p>${eventName}${vip ? ' &#128378;' : ''}</p>
								<p>${i + 1}/${tickets.length}</p>
							</div>
						`)).join('\n')}
					</div>
					<div class="swiper-pagination"></div>
					<div class="swiper-button-next"></div>
					<div class="swiper-button-prev"></div>
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
