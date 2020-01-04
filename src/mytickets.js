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

			const { confirmationId } = tickets[0];

			const ticketsHTML = `
				<h1>Your tickets</h1>
				<h2>Order #${confirmationId}</h2>
				<p class="download-wallet">
					<a href="${API_HOST}/v1/mytickets/pdf?t=${transactionToken}">Print/Download PDF</a>
					<a href="#">Add to Apple Wallet</a>
				</p>
				${tickets.map(({ firstName, lastName, eventName, eventDate, qrCode }) => (`
					<div class="flex-row ticket">
						<dl>
							<dt>Guest</dt>
							<dd>${firstName} ${lastName}</dd>

							<dt>Event</dt>
							<dd>${eventName}</dd>

							<dt>Date</dt>
							<dd>${(new Date(eventDate)).toString()}</dd>
						</dl>
						<div class="img-wrap">
							<img src="${qrCode}" />
						</div>
					</div>
				`)).join('\n')}
			`;

			document.querySelector('main').innerHTML = ticketsHTML;
		})
		.then()
		.catch(handleError);
} else {
	// shouldn't land on this page without a transaction token
	handleError();
}
