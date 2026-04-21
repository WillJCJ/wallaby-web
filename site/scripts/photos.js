const initializePhotosPage = () => {
	const section = document.querySelector('.photos-section');
	const grid = document.getElementById('photos-grid');
	const feature = document.getElementById('photos-feature');
	const featureImage = document.getElementById('photos-feature-image');
	const featureCaption = document.getElementById('photos-feature-caption');
	const prevButton = document.getElementById('photos-prev');
	const nextButton = document.getElementById('photos-next');

	if (!section || !grid || !feature || !featureImage || !featureCaption || !prevButton || !nextButton) {
		return;
	}

	const tiles = Array.from(grid.querySelectorAll('.photo-tile'));
	if (tiles.length === 0) {
		return;
	}

	let activeIndex = 0;

	const photoUrl = (id) => `/cdn-cgi/image/width=1400,format=auto/api/photos/${encodeURIComponent(id)}`;

	const dataForIndex = (index) => {
		const tile = tiles[index];
		const thumb = tile?.querySelector('.photo-thumb');
		if (!thumb) {
			return null;
		}

		return {
			id: thumb.dataset.photoId || '',
			alt: thumb.dataset.photoAlt || '',
			caption: thumb.dataset.photoCaption || '',
		};
	};

	const setActive = (index) => {
		activeIndex = (index + tiles.length) % tiles.length;
		tiles.forEach((tile, tileIndex) => {
			tile.dataset.active = tileIndex === activeIndex ? 'true' : 'false';
		});

		const photo = dataForIndex(activeIndex);
		if (!photo || !photo.id) {
			return;
		}

		featureImage.src = photoUrl(photo.id);
		featureImage.alt = photo.alt;
		featureCaption.textContent = photo.caption;
	};

	setActive(activeIndex);

	tiles.forEach((tile, index) => {
		const trigger = tile.querySelector('.photo-thumb');

		trigger?.addEventListener('click', () => {
			setActive(index);
			feature.focus();
		});
	});

	prevButton.addEventListener('click', () => {
		setActive(activeIndex - 1);
		feature.focus();
	});

	nextButton.addEventListener('click', () => {
		setActive(activeIndex + 1);
		feature.focus();
	});

	section.addEventListener('keydown', (event) => {
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			setActive(activeIndex + 1);
		}

		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			setActive(activeIndex - 1);
		}
	});
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializePhotosPage);
} else {
	initializePhotosPage();
}