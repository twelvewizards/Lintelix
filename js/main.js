// Parallax for the hero background (keeps background grounded)
const hero = document.querySelector('.hero');
const PARALLAX_SPEED = 0.3; // tweak between ~0.03 (subtle) and 0.5 (strong)
let ticking = false;

const updateParallax = () => {
	if (!hero) return;
	const rect = hero.getBoundingClientRect();
	const elementCenterY = rect.top + rect.height / 2;
	const viewportCenterY = window.innerHeight / 2;
	// delta is positive when viewport center is below element center
	const delta = (viewportCenterY - elementCenterY) * PARALLAX_SPEED;
	// use calc so the baseline is 50% (center) and we offset in pixels
	hero.style.backgroundPosition = `center calc(50% + ${delta}px)`;
};

const onScroll = () => {
	if (!ticking) {
		ticking = true;
		requestAnimationFrame(() => {
			updateParallax();
			ticking = false;
		});
	}
};

// init and hook events
updateParallax();
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', updateParallax);

// Navbar: toggle semi-transparent background when not at the top
(function () {
	const topNav = document.querySelector('.top-nav');
	const hero = document.querySelector('.hero');
	if (!topNav || !hero) return;

	// Compute a progress value (0..1) while scrolling through the hero
	// and smoothly lerp alpha and blur toward targets for a pleasant effect.
	const MAX_ALPHA = 0.65; // final semi-transparent alpha
	const START_AT = 0.5; // begin fade at 50% of hero
	const MAX_BLUR = 3; // px at maximum

	let targetAlpha = 0;
	let currentAlpha = 0;
	let targetBlur = 0;
	let currentBlur = 0;
	let rafId = null;

	function updateTargets() {
		const heroHeight = hero.offsetHeight || 1;
		const scroll = Math.max(window.scrollY, 0);
		let progress = scroll / heroHeight;
		if (progress < 0) progress = 0;
		if (progress > 1) progress = 1;

		// compute target alpha (0..MAX_ALPHA), starting at START_AT
		if (progress > START_AT) {
			const t = (progress - START_AT) / (1 - START_AT);
			targetAlpha = Math.min(1, Math.max(0, t)) * MAX_ALPHA;
		} else {
			targetAlpha = 0;
		}

		// map alpha proportionally to blur amount (fraction of MAX_BLUR)
		const fraction = MAX_ALPHA > 0 ? targetAlpha / MAX_ALPHA : 0;
		targetBlur = fraction * MAX_BLUR;

		// ensure class reflects visible state for fallback
		if (targetAlpha > 0.001) topNav.classList.add('top-nav--scrolled');
		else topNav.classList.remove('top-nav--scrolled');

		// start animation loop if needed
		if (rafId === null) {
			rafId = requestAnimationFrame(animateNav);
		}
	}

	function animateNav() {
		// lerp towards target values
		const ease = 0.16; // lerp factor (0..1) — smaller == smoother
		currentAlpha += (targetAlpha - currentAlpha) * ease;
		currentBlur += (targetBlur - currentBlur) * ease;

		// apply to CSS vars (blur in px)
		topNav.style.setProperty('--nav-alpha', String(currentAlpha));
		topNav.style.setProperty('--nav-blur', `${currentBlur}px`);

		// if not yet close to targets, continue animating
		if (Math.abs(currentAlpha - targetAlpha) > 0.001 || Math.abs(currentBlur - targetBlur) > 0.1) {
			rafId = requestAnimationFrame(animateNav);
		} else {
			// snap to final values and stop
			topNav.style.setProperty('--nav-alpha', String(targetAlpha));
			topNav.style.setProperty('--nav-blur', `${targetBlur}px`);
			rafId = null;
		}
	}

	// init and listen
	updateTargets();
	window.addEventListener('scroll', updateTargets, { passive: true });
	window.addEventListener('resize', updateTargets);

	// Smooth-scroll the brand link to the top of the page without navigating away.
	const brandLink = document.querySelector('.top-nav__brand');
	if (brandLink) {
		brandLink.addEventListener('click', (e) => {
			// allow modified clicks and non-left clicks to behave normally
			if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
			e.preventDefault();
			window.scrollTo({ top: 0, behavior: 'smooth' });
		});
	}

	// Remove persistent focus state for pointer clicks so links don't 'stay' active.
	// Keyboard users keep focus for accessibility (clicks from keyboard have event.detail === 0).
	const navInteractive = document.querySelectorAll('.top-nav__link, .top-nav__cta');
	if (navInteractive.length) {
		navInteractive.forEach((el) => {
			el.addEventListener('click', (ev) => {
				try {
					if (ev.detail !== 0) {
						// pointer-generated click — blur to remove focus styles
						setTimeout(() => el.blur(), 0);
					}
				} catch (e) {
					// ignore
				}
			});
		});
	}
})();

// Action section carousel: same-sized cards with partial next-card preview,
// previous/next controls, and drag/swipe support.
(function () {
	const carousel = document.querySelector('.action__carousel');
	if (!carousel) return;

	const track = carousel.querySelector('.action__track');
	const slides = Array.from(carousel.querySelectorAll('.action__card'));
	const prevButton = carousel.querySelector('.action__arrow--prev');
	const nextButton = carousel.querySelector('.action__arrow--next');
	const frame = carousel.closest('.action__frame');
	const dots = Array.from((frame || document).querySelectorAll('.action__dot'));

	if (!track || slides.length < 2 || !prevButton || !nextButton) return;

	let index = 0;
	let pointerIsDown = false;
	let dragStarted = false;
	let startX = 0;
	let startOffset = 0;
	let dragDelta = 0;
	let suppressClick = false;

	function getGapPx() {
		const trackStyle = window.getComputedStyle(track);
		const raw = trackStyle.columnGap || trackStyle.gap || '0px';
		const value = Number.parseFloat(raw);
		return Number.isFinite(value) ? value : 0;
	}

	function getStepWidth() {
		const slideWidth = slides[0].getBoundingClientRect().width;
		return slideWidth + getGapPx();
	}

	function getMinOffset() {
		const viewportWidth = carousel.getBoundingClientRect().width;
		const trackWidth = track.scrollWidth;
		return Math.min(0, viewportWidth - trackWidth);
	}

	function clampOffset(offset) {
		const min = getMinOffset();
		if (offset < min) return min;
		if (offset > 0) return 0;
		return offset;
	}

	function setTrackOffset(offsetPx, animate = true) {
		track.style.transition = animate ? '' : 'none';
		track.style.transform = `translateX(${clampOffset(offsetPx)}px)`;
	}

	function setActiveDot() {
		dots.forEach((dot, dotIndex) => {
			const isActive = dotIndex === index;
			dot.classList.toggle('action__dot--active', isActive);
			dot.setAttribute('aria-current', isActive ? 'true' : 'false');
		});
	}

	function setArrowState() {
		const atFirst = index === 0;
		const atLast = index === slides.length - 1;
		prevButton.disabled = atFirst;
		nextButton.disabled = atLast;
		prevButton.setAttribute('aria-hidden', atFirst ? 'true' : 'false');
		nextButton.setAttribute('aria-hidden', atLast ? 'true' : 'false');
		carousel.classList.toggle('action__carousel--at-start', atFirst);
		carousel.classList.toggle('action__carousel--at-end', atLast);
	}

	function updateTrack(animate = true) {
		setTrackOffset(-index * getStepWidth(), animate);
		setActiveDot();
		setArrowState();
	}

	function moveBy(delta) {
		const nextIndex = index + delta;
		const bounded = Math.min(slides.length - 1, Math.max(0, nextIndex));
		if (bounded === index) return;
		index = bounded;
		updateTrack();
	}

	prevButton.addEventListener('click', () => moveBy(-1));

	nextButton.addEventListener('click', () => {
		moveBy(1);
	});

	dots.forEach((dot, dotIndex) => {
		dot.addEventListener('click', () => {
			index = dotIndex;
			updateTrack();
		});
	});

	carousel.addEventListener('pointerdown', (event) => {
		if (event.button !== 0) return;
		if (event.target.closest('.action__arrow, .action__dot')) return;

		pointerIsDown = true;
		dragStarted = false;
		dragDelta = 0;
		startX = event.clientX;
		startOffset = clampOffset(-index * getStepWidth());

		carousel.classList.add('is-dragging');
		setTrackOffset(startOffset, false);
		carousel.setPointerCapture(event.pointerId);
	});

	carousel.addEventListener('pointermove', (event) => {
		if (!pointerIsDown) return;

		dragDelta = event.clientX - startX;
		if (Math.abs(dragDelta) > 5) {
			dragStarted = true;
		}

		setTrackOffset(startOffset + dragDelta, false);
	});

	function settleDrag(event) {
		if (!pointerIsDown) return;
		pointerIsDown = false;
		carousel.classList.remove('is-dragging');

		try {
			carousel.releasePointerCapture(event.pointerId);
		} catch (error) {
			// ignore release failures
		}

		const threshold = Math.max(36, Math.min(84, getStepWidth() * 0.1));
		if (dragDelta <= -threshold && index < slides.length - 1) {
			index += 1;
		} else if (dragDelta >= threshold && index > 0) {
			index -= 1;
		}

		suppressClick = dragStarted;
		track.style.transition = '';
		updateTrack();
	}

	carousel.addEventListener('pointerup', settleDrag);
	carousel.addEventListener('pointercancel', settleDrag);

	carousel.addEventListener('click', (event) => {
		if (!suppressClick) return;
		event.preventDefault();
		event.stopPropagation();
		suppressClick = false;
	}, true);

	window.addEventListener('resize', () => updateTrack(false));
	updateTrack(false);
})();
