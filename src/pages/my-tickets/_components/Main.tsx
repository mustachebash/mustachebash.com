import { useCallback, useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { API_HOST } from 'astro:env/client';

// import qrcode from 'qrcode';

import classNames from 'classnames';
import styles from './Main.module.css';

type EventTicket = {
	id: string;
	customerId: string;
	orderId: string;
	orderCreated: string;
	admissionTier: string;
	status: string;
	checkInTime: string | null;
	eventId: string;
	eventName: string;
	eventDate: string;
	upgradeProductId: string | null;
	upgradePrice: number | null;
	upgradeName: string | null;
	qrPayload: string | null;
	qrCode?: string;
};

type Accommodation = {
	customerId: string;
	orderId: string;
	orderCreated: string;
	productName: string;
	eventId: string;
	eventName: string;
	eventDate: string;
};

const Main = () => {
	const orderToken = new URLSearchParams(location.search).get('t'),
		[customer, setCustomer] = useState<Record<string, any> | null>(null),
		[tickets, setTickets] = useState<EventTicket[] | null>(null),
		[accommodations, setAccommodations] = useState<Accommodation[] | null>(null),
		[error, setError] = useState<Error | null>(null),
		[selectedUpgradeTickets, setSelectedUpgradeTickets] = useState<string[]>([]),
		[selectedTransferTickets, setSelectedTransferTickets] = useState<string[]>([]),
		[recipientName, setRecipientName] = useState(''),
		[recipientEmail, setRecipientEmail] = useState(''),
		[recipientNameError, setRecipientNameError] = useState(false),
		[recipientEmailError, setRecipientEmailError] = useState(false);

	const upgradeDialog = useRef<HTMLDialogElement>(null),
		transferDialog = useRef<HTMLDialogElement>(null),
		transferSuccessDialog = useRef<HTMLDialogElement>(null);

	const fetchTicketData = useCallback(async () => {
		if (orderToken) {
			// Fetch the initial settings and products
			fetch(`${API_HOST}/v1/mytickets?t=${orderToken}`)
				.then(response => {
					if (!response.ok) throw new Error('Tickets not loaded');

					if (response.status === 204) {
						return { customer: null, tickets: [], accommodations: [] } as {
							customer: null | Record<string, any>;
							tickets: EventTicket[];
							accommodations: Accommodation[];
						};
					}

					return response.json() as Promise<{
						customer: Record<string, any>;
						tickets: EventTicket[];
						accommodations: Accommodation[];
					}>;
				})
				// .then(async ({ customer, tickets, accommodations }) => {
				// 	for (const ticket of tickets) {
				// 		const { qrPayload } = ticket;

				// 		if (qrPayload) {
				// 			try {
				// 				const qrCode = await qrcode.toDataURL(qrPayload, { scale: 8, errorCorrectionLevel: 'M' });

				// 				ticket.qrCode = qrCode;
				// 			} catch (e) {
				// 				console.error('QR code generation failed', e);
				// 			}
				// 		}
				// 	}

				// 	return { customer, tickets, accommodations };
				// })
				.then(({ customer, tickets, accommodations }) => {
					setCustomer(customer);
					setTickets(tickets);
					setAccommodations(accommodations);
				})
				.catch((e: Error) => {
					setError(e);
					console.error(e);
				});
		}
	}, [orderToken]);

	const openUpgradeDialog = useCallback(() => {
		setSelectedUpgradeTickets([]);
		if (upgradeDialog.current) upgradeDialog.current.showModal();
	}, [upgradeDialog]);

	const closeUpgradeDialog = useCallback(() => {
		if (upgradeDialog.current) upgradeDialog.current.close();
	}, [upgradeDialog]);

	const openTransferDialog = useCallback(() => {
		setSelectedTransferTickets([]);
		setRecipientName('');
		setRecipientEmail('');
		if (transferDialog.current) transferDialog.current.showModal();
	}, [transferDialog]);

	const closeTransferDialog = useCallback(() => {
		if (transferDialog.current) transferDialog.current.close();
	}, [transferDialog]);

	const openTransferSuccessDialog = useCallback(() => {
		if (transferSuccessDialog.current) transferSuccessDialog.current.showModal();
	}, [transferSuccessDialog]);

	const closeTransferSuccessDialog = useCallback(() => {
		if (transferSuccessDialog.current) transferSuccessDialog.current.close();
	}, [transferSuccessDialog]);

	const confirmTransfer = useCallback(() => {
		if (!tickets?.length) return;

		let isValid = true;
		if (!/.+\s.+/.test(recipientName.trim())) {
			setRecipientNameError(true);
			isValid = false;
		} else {
			setRecipientNameError(false);
		}

		if (!/.+@.+\..{2,}$/.test(recipientEmail.trim())) {
			setRecipientEmailError(true);
			isValid = false;
		} else {
			setRecipientEmailError(false);
		}

		if (!selectedTransferTickets.length) {
			isValid = false;
		}

		if (!isValid) {
			return;
		}

		// Send the transfer request
		fetch(`${API_HOST}/v1/mytickets/transfers`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				orderToken,
				transferee: {
					firstName: recipientName.split(' ')[0]?.trim(),
					lastName: recipientName.split(' ').slice(1).join(' ').trim(),
					email: recipientEmail.trim()
				},
				tickets: tickets
					.filter(ticket => selectedTransferTickets.includes(ticket.id))
					.map(ticket => ({
						id: ticket.id,
						orderId: ticket.orderId,
						customerId: ticket.customerId
					}))
			})
		})
			.then(response => {
				if (!response.ok) throw new Error('Transfer failed');

				return response;
			})
			.then(response => response.json())
			.then(fetchTicketData)
			.then(() => {
				closeTransferDialog();
				openTransferSuccessDialog();
			})
			.catch(e => {
				console.error(e);
				alert('Transfer failed');
			});
	}, [recipientName, recipientEmail, selectedTransferTickets, tickets, fetchTicketData]);

	const handleTransferRecipientNameChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setRecipientName(e.target.value);
		},
		[setRecipientName]
	);

	const handleTransferRecipientEmailChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setRecipientEmail(e.target.value);
		},
		[setRecipientEmail]
	);

	const handleTicketUpgradeCheckboxChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const { value } = e.target;

			if (e.target.checked) {
				setSelectedUpgradeTickets([...selectedUpgradeTickets, value]);
			} else {
				setSelectedUpgradeTickets(selectedUpgradeTickets.filter(id => id !== value));
			}
		},
		[selectedUpgradeTickets, setSelectedUpgradeTickets]
	);

	const handleTicketTransferCheckboxChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const { value } = e.target;

			if (e.target.checked) {
				setSelectedTransferTickets([...selectedTransferTickets, value]);
			} else {
				setSelectedTransferTickets(selectedTransferTickets.filter(id => id !== value));
			}
		},
		[selectedTransferTickets, setSelectedTransferTickets]
	);

	useEffect(() => {
		fetchTicketData();
	}, []);

	if (error || !orderToken) {
		return (
			<main className={styles.main}>
				<div className="container-1230">
					<h5 style={{ paddingTop: '5em', color: '#602a34', textAlign: 'center' }}>
						Something seems to be broken,
						<br />
						please refresh the page and try again
					</h5>
					<p>
						If the problem persists, please contact support at <a href="mailto:contact@mustachebash.com">contact@mustachebash.com</a>
					</p>
				</div>
			</main>
		);
	}

	// This is loading state
	if (!tickets) return null;

	type EventOrderDetails = {
		id: string;
		name: string;
		dateString: string;
		timeString: string;
		tickets: EventTicket[];
	};

	const eventsById: Record<string, EventOrderDetails> = {};

	tickets?.forEach(ticket => {
		const { eventId, eventName, eventDate } = ticket;
		if (!eventsById[eventId]) {
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
		<main className={styles.main}>
			<div className="container-1230">
				{customer && (
					<>
						<h3>
							{customer.firstName} {customer.lastName}
						</h3>
						<h2>{customer.email}</h2>
					</>
				)}
				{customer && !!accommodations?.length && (
					<>
						<h4>Active Accommodations</h4>
						<ul>
							{accommodations.map(accommodation => (
								<li key={accommodation.orderId}>{accommodation.productName} - Tickets Collected at Check-In</li>
							))}
						</ul>
					</>
				)}
				{customer && !!tickets.length ? (
					<>
						<h4>Active tickets</h4>
						<p className="download-wallet">{/*<a className="wallet" href="#"><img src="./img/apple-wallet.svg" /></a>*/}</p>
						<p className="disclaimer">
							This is event is 21+ only. All guests must have a valid ID and ticket to check in. Do not share this link with anyone. If you have any additional questions, please{' '}
							<a href="/info" target="_blank">
								visit our FAQs
							</a>
							.
						</p>
						<p className="instructions">
							Swipe to scan different tickets.
							<br className="mobile-only" /> Scroll down for more ticket details.
						</p>
						<div className="tickets swiper-container">
							<Swiper className="swiper-wrapper" navigation pagination={{ clickable: true }}>
								{tickets.map(({ id, qrCode, eventName, admissionTier }, i) => (
									<SwiperSlide className="ticket swiper-slide" key={`swiper-${id}`}>
										<div className={`img-wrap ${!qrCode ? 'outline' : ''}`}>
											{qrCode ? (
												<img src={qrCode} />
											) : (
												<h5>
													Your Tickets will be shown here
													<br />
													closer to the event
												</h5>
											)}
										</div>
										<p>
											{eventName}
											{admissionTier === 'vip' ? <> &#128378;</> : ''}
										</p>
										<p>
											{i + 1}/{tickets.length}
										</p>
									</SwiperSlide>
								))}
							</Swiper>
						</div>
					</>
				) : !accommodations?.length ? (
					<>
						<h4>You have no active tickets</h4>
						<p>
							If you believe you should have tickets, please contact support at <a href="mailto:contact@mustachebash.com">contact@mustachebash.com</a> and provide your email and order
							confirmation number.
						</p>
					</>
				) : null}
			</div>
			{!!tickets.length && (
				<div className="tickets-list">
					<div className="container-1230">
						{Object.values(eventsById).map(({ name: eventName, dateString, timeString, tickets: eventTickets }) => (
							<div className="event-group" key={eventName}>
								<div className="event-info">
									<h4>{eventName}</h4>
									<p>
										{dateString} at {timeString}
									</p>
								</div>

								<div className={styles.upgradeTransfer}>
									{eventTickets.some(ticket => ticket.upgradeProductId) && (
										<button className="yellow" onClick={openUpgradeDialog}>
											Upgrade
										</button>
									)}
									<button className="yellow" onClick={openTransferDialog}>
										Transfer
									</button>
								</div>
								<ul>
									{[...eventTickets]
										.sort((a, b) => {
											// Rank by tier first
											if (a.admissionTier === 'vip' && b.admissionTier !== 'vip') return -1;
											if (a.admissionTier !== 'vip' && b.admissionTier === 'vip') return 1;

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
															<h5>{admissionTier === 'vip' ? <span>VIP &#128378;</span> : window.innerWidth > 420 ? 'General Admission' : 'GA'}</h5>
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
			)}
			<dialog className="upgrade-dialog" ref={upgradeDialog}>
				<h4>Upgrade to VIP Tickets</h4>
				<p>Please select the tickets you would like to upgrade to VIP (includes afterparty)</p>
				<ul>
					{tickets
						.filter(ticket => ticket.upgradeProductId)
						.map(({ id, eventName, upgradePrice }, i) => (
							<li key={id}>
								<input
									type="checkbox"
									value={id}
									id={`ticket-upgrade-${id}-checkbox`}
									onChange={handleTicketUpgradeCheckboxChange}
									checked={selectedUpgradeTickets.some(tid => tid === id)}
								/>
								<label htmlFor={`ticket-upgrade-${id}-checkbox`}>
									#{i + 1} - {eventName} - ${upgradePrice}
								</label>
							</li>
						))}
				</ul>
				<div className={styles.dialogCta}>
					<button className="yellow" onClick={closeUpgradeDialog}>
						Upgrade
					</button>
					<button className="yellow" onClick={closeUpgradeDialog}>
						Cancel
					</button>
				</div>
			</dialog>
			<dialog className={classNames(styles.dialog, styles.transferDialog)} ref={transferDialog}>
				<h4>Transfer Tickets</h4>
				<p>
					Please select the tickets you would like to transfer and enter recipient's name and email. Once a ticket has been transferred, it cannot be taken back! Only transfer to people you
					trust.
				</p>
				<ul>
					{tickets.map(({ id, eventName }, i) => (
						<li key={id}>
							<input
								type="checkbox"
								value={id}
								id={`ticket-transfer-${id}-checkbox`}
								onChange={handleTicketTransferCheckboxChange}
								checked={selectedTransferTickets.some(tid => tid === id)}
							/>
							<label htmlFor={`ticket-transfer-${id}-checkbox`}>
								#{i + 1} - {eventName}
							</label>
						</li>
					))}
				</ul>
				<div>
					<label htmlFor="recipient-name">Recipient Name{recipientNameError ? <span className={styles.labelError}> - Full Name Required</span> : ''}</label>
					<input
						type="text"
						id="recipient-name"
						className={classNames({ [styles.inputError as string]: recipientNameError })}
						onChange={handleTransferRecipientNameChange}
						value={recipientName}
					/>
				</div>
				<div>
					<label htmlFor="recipient-email">Recipient Email{recipientEmailError ? <span className={styles.labelError}> - Valid Email Required</span> : ''}</label>
					<input
						type="email"
						id="recipient-email"
						className={classNames({ [styles.inputError as string]: recipientEmailError })}
						onChange={handleTransferRecipientEmailChange}
						value={recipientEmail}
						pattern="^.+@.+\..{2,}$"
						required
					/>
				</div>
				<div className={styles.dialogCta}>
					<button className="yellow" onClick={confirmTransfer}>
						Transfer
					</button>
					<button className="yellow" onClick={closeTransferDialog}>
						Cancel
					</button>
				</div>
			</dialog>
			<dialog className={classNames(styles.dialog, styles.transferSuccessDialog)} ref={transferSuccessDialog}>
				<h4>Success!</h4>
				<p>
					Your tickets have been successfully transferred to <strong>{recipientName}</strong> and they have been emailed their confirmation to <strong>{recipientEmail}</strong>.
				</p>
				<div className={styles.dialogCta}>
					<button className="yellow" onClick={closeTransferSuccessDialog}>
						Ok
					</button>
				</div>
			</dialog>
		</main>
	);
};

export default Main;
