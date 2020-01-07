import 'normalize.css';
import 'mytickets.less';

import url from 'url';

const { t: transactionToken } = url.parse(location.href, true).query,
	handleError = () => {
		// If anything errors, we need to show a message in the tickets section
		document.querySelector('main').innerHTML = `
			<h5 style="padding-top: 5em; color: #602a34; text-align: center">
				Something seems to be broken,<br>please refresh the page and try again
			</h5>
			<p>If the problem persists, please contact support at <a href="mailto:contact@mustachebash.com">contact@mustachebash.com</a></p>
		`;
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
			tickets.sort((a, b) => a.lastName > b.lastName ? 1 : -1);

			const { confirmationId, firstName, lastName, eventName, eventDate } = tickets[0],
				dateString = (new Date(eventDate)).toLocaleDateString('en-US', {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				});

			const ticketsHTML = `
				<h1>Your tickets</h1>
				<h2>Order #${confirmationId}</h2>
				<h2>Purchased by ${firstName} ${lastName}</h2>
				<h4>${eventName}</h4>
				<h4>${dateString}</h4>
				<p class="download-wallet">
					<a class="download" href="${API_HOST}/v1/mytickets/pdf?t=${transactionToken}">Print/Download PDF</a>
					<a class="wallet" href="#"><img src="/img/apple-wallet.svg" /></a>
				</p>
				<div class="tickets">
					${tickets.map(({ qrCode }, i) => (`
						<div class="ticket">
							<div class="img-wrap">
								<img src="${qrCode}" />
							</div>
							<p>${i + 1} of ${tickets.length}</p>
						</div>
					`)).join('\n')}
				</div>
			`;

			document.querySelector('main').innerHTML = ticketsHTML;
		})
		.then()
		.catch(handleError);
} else {
	// shouldn't land on this page without a transaction token
	handleError();
}
