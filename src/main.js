import 'normalize.css';
import 'main.less';

// Animate Nav links - quick n dirty vanilla style
// TODO: Make this less janky
let scrollAnimationReqId;
document.querySelectorAll('nav').forEach(el => el.addEventListener('click', e => {
	if(e.target.hash) {
		e.preventDefault();
		window.cancelAnimationFrame(scrollAnimationReqId);

		document.querySelector('#menu-icon').classList.remove('open');

		// Offset by 75px for the header
		const scrollPos = document.querySelector(e.target.hash).offsetTop - 75,
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
