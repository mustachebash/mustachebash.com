import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { API_HOST } from 'astro:env/client';

const Main = () => {
	const orderToken = new URLSearchParams(location.search).get('t'),
		[customer, setCustomer] = useState<Record<string, any> | null>(null),
		[tickets, setTickets] = useState<Record<string, any>[] | null>(null),
		[error, setError] = useState<Error | null>(null);

	useEffect(() => {
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
					setCustomer(customer);
					setTickets(tickets);
				})
				.catch((e: Error) => {
					setError(e);
					console.error(e)
				});
		}
	}, []);

	if(error || !orderToken) {
		return (
			<>
				<h5 style={{paddingTop: '5em', color: '#602a34', textAlign: 'center'}}>
					Something seems to be broken,<br />please refresh the page and try again
				</h5>
				<p>If the problem persists, please contact support at <a href="mailto:contact@mustachebash.com">contact@mustachebash.com</a></p>
			</>
		);
	}

	if(!customer || !tickets) return null;

	const { firstName, lastName, email } = customer;

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

	return (
		<main>
			<div className="container-1230">
				<h4>Active tickets</h4>
				<h3>{firstName} {lastName}</h3>
				<h2>{email}</h2>
				<p className="download-wallet">
					{/*<a className="wallet" href="#"><img src="./img/apple-wallet.svg" /></a>*/}
				</p>
				<p className="disclaimer">
					This is event is 21+ only. All guests must have a valid ID and ticket to check in. Do not share this link
					with anyone. If you have any additional questions, please <a href="/info" target="_blank">visit our FAQs</a>.
				</p>
				<p className="instructions">
					Swipe to scan different tickets.<br className="mobile-only" /> Scroll down for more ticket details.
				</p>
				<div className="tickets swiper-container">
					<Swiper
						className="swiper-wrapper"
						navigation
						pagination={{ clickable: true }}
					>
						{tickets.map(({ id, qrCode, eventName, admissionTier }, i) => (
							<SwiperSlide className="ticket swiper-slide" key={`swiper-${id}`}>
								<div className={`img-wrap ${!qrCode ? 'outline' : ''}`}>
									{qrCode ? <img src={qrCode} /> : <h5>Your Tickets will be shown here<br />closer to the event</h5>}
								</div>
								<p>{eventName}{admissionTier === 'vip' ? ' &#128378;' : ''}</p>
								<p>{i + 1}/{tickets.length}</p>
							</SwiperSlide>
						))}
					</Swiper>
				</div>
			</div>
			{!tickets.length && <p>No tickets returned</p>}
			<div className="tickets-list">
				<div className="container-1230">
					{Object.values(eventsById).map(({ name: eventName, dateString, timeString, tickets: eventTickets }) => (
						<div className="event-group" key={eventName}>
							<div className="event-info">
								<h4>{eventName}</h4>
								<p>{dateString} at {timeString}</p>
							</div>
							<ul>
							{[...eventTickets]
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

									return (
										<li className={admissionTier === 'vip' ? 'vip-tier' : 'general-tier'} key={id}>
											<div className="info">
												<div className="ticket-number">
													<h2>#{i + 1}</h2>
												</div>
												<div className="ticket-tier">
													<h5>{admissionTier === 'vip'
															? <span>VIP &#128378;</span>
															: window.innerWidth > 420
																? 'General Admission'
																: 'GA'
													}</h5>
												</div>
												<div className="ticket-ids">
													<p>Ticket #{ticketId}</p>
													<p>Confirmation #{confirmationId}</p>
												</div>
											</div>
										</li>
									);
								})}
							</ul>
						</div>
					))}
				</div>
			</div>
		</main>
	);
};

export default Main;
