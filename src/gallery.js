import 'normalize.css';
import 'gallery.less';

// Mobile menu
document.querySelector('#menu-icon').addEventListener('click', e => {
	e.currentTarget.classList.toggle('open');
});

// Gallery
function importGallery(r) {
	return r.keys().reduce((obj, cur) => (obj[cur.replace('./img/gallery/', '')] = r(cur), obj), {});
}
const galleryImages = importGallery(require.context('./img/gallery', false, /^\..+\.jpg$/));
try {
	const slidesHtml = Object.keys(galleryImages).map(image => {
		return `
			<div class="gallery-item">
				<img src="${galleryImages[image]}" />
			</div>
		`;
	});

	document.querySelector('.gallery-wrapper').innerHTML = slidesHtml.join('\n');

	// if(typeof window.gtag === 'function') {
	// 	window.gtag('event', 'click', {
	// 		event_category: 'gallery',
	// 		event_label: 'Next Slide'
	// 	});
	// }
} catch(e) {
	console.error('Gallery failed to load', e);
}
