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
		// Keep interactive controls clickable and don't start drag from them.
		if (event.target.closest('.action__arrow, .action__dot, .action__button, button, a')) return;

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
		// Never swallow storyboard trigger clicks.
		if (event.target.closest('.action__button[data-storyboard]')) {
			suppressClick = false;
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		suppressClick = false;
	}, true);

window.addEventListener('resize', () => updateTrack(false));
	updateTrack(false);
})();

// Storyboard modal: opens from "Watch Now" buttons in the action cards.
(function () {
	const modal = document.querySelector('.storyboard-modal');
	if (!modal) return;

	const dialog = modal.querySelector('.storyboard-modal__dialog');
	const titleElement = modal.querySelector('#storyboard-modal-title');
	const content = modal.querySelector('.storyboard-modal__content');
	const closeButton = modal.querySelector('.storyboard-modal__close');
	const viewButtons = Array.from(modal.querySelectorAll('.storyboard-modal__view-btn'));
	const triggerButtons = Array.from(document.querySelectorAll('.action__button[data-storyboard]'));
	const ENABLE_SINGLE_VIEW = false;

	if (!dialog || !titleElement || !content || !closeButton || viewButtons.length === 0 || triggerButtons.length === 0) {
		return;
	}

	const basementShotlistFrames = [
		{ scene: 'Scene 1', shot: 'Shot 1', caption: 'INT. CU - Straight angle. JOHN. "Great news Dave.."' },
		{ scene: 'Scene 1', shot: 'Shot 2', caption: 'INT. CU - Straight angle, DAVE. "Great!"' },
		{ scene: 'Scene 1', shot: 'Shot 3', caption: 'INT. MCU - OTS Dave, of JOHN. "All they need from you..."' },
		{ scene: 'Scene 1', shot: 'Shot 4', caption: 'INT. MCU - OTS John, of DAVE. Reacting to John.' },
		{ scene: 'Scene 1', shot: 'Shot 5', caption: 'INT. ECU - JOHN\'s face. "The basement."' },
		{ scene: 'Scene 2', shot: 'Shot 1', caption: 'INT. WS - Elevator doors open, Dave stands holding flashlight. ZOOM OUT.' },
		{ scene: 'Scene 2', shot: 'Shot 2', caption: 'INT. MCU - OTS, Dave walks into the basement, revealing boxes everywhere.' },
		{ scene: 'Scene 2', shot: 'Shot 3', caption: 'INT. MCU - Dave begins searching through boxes.' },
		{ scene: 'Scene 2', shot: 'Shot 4', caption: 'INT. CU - Dave\'s beard has grown, pile of papers behind.' },
		{ scene: 'Scene 2', shot: 'Shot 5', caption: 'INT. WS - Dave sits on floor searching. His hair is greying, pile larger.' },
		{ scene: 'Scene 2', shot: 'Shot 6', caption: 'INT. CU - Dave\'s face lights up, he found it.' },
		{ scene: 'Scene 3', shot: 'Shot 1', caption: 'INT. WS -> CU - Elevator doors open. Dave runs out excited "I found it!". He runs up to camera, then a look of disappointment and realization on his face.' },
		{ scene: 'Scene 3', shot: 'Shot 2', caption: 'INT. WS - OTS Dave, reveal dark empty foyer. No one is there. It\'s night, janitor in background. Track out slowly from Dave, Dave drops paper.' },
		{ scene: 'Scene 4', shot: 'Shot 1', caption: 'Man on a computer, drinking a cup of coffee, using Asset Memory.' },
		{ scene: 'Scene 4', shot: 'Shot 2', caption: 'Dave steps forward.' },
		{ scene: 'Scene 4', shot: 'Shot 3', caption: 'A montage begins.' },
		{ scene: 'Scene 4', shot: 'Shot 4', caption: 'Time passes. He continues searching.' },
		{ scene: 'Scene 4', shot: 'Shot 5', caption: 'More time passes. He grows weary.' },
		{ scene: 'Scene 4', shot: 'Shot 6', caption: 'But finally, a spark lights up.' }
	];

	const familiarCaptions = [
		'Searching scattered handover folders',
		'Comparing disconnected document sets',
		'Tracing who approved what and when',
		'Finding the root source for a claim',
		'Locating evidence during time pressure',
		'Checking if updates reached every team',
		'Resolving mismatched file versions',
		'Identifying data gaps before audits',
		'Linking operations queries to evidence',
		'Reviewing key decisions by timeline',
		'Building a consistent project memory',
		'Sharing one clear answer with source'
	];

	function buildFramesFromImageRange(folderName, startNumber, endNumber, captions) {
		const frames = [];
		for (let imageNumber = startNumber; imageNumber <= endNumber; imageNumber += 1) {
			const index = imageNumber - startNumber;
			frames.push({
				scene: `Scene ${Math.floor(index / 4) + 1}`,
				shot: `Shot ${(index % 4) + 1}`,
				caption: captions[index] || `Storyboard frame ${imageNumber}`,
				image: `assets/img/${folderName}/${imageNumber}.jpg`
			});
		}
		return frames;
	}

	const stories = {
		basement: {
			title: 'The Basement',
			frames: basementShotlistFrames.map((frame, index) => ({ ...frame, image: `assets/img/the_basement/${index + 4}.jpg` }))
		},
		familiar: {
			title: 'Seem Familiar?',
			frames: buildFramesFromImageRange('seems_familiar', 24, 40, familiarCaptions)
		}
	};

	let activeStoryKey = null;
	let currentMode = 'multi';
	let activeFrameIndex = 0;
	let isOpen = false;
	let closeTimerId = null;
	let previousBodyOverflow = '';
	let returnFocusTo = null;

	function getActiveStory() {
		if (!activeStoryKey || !stories[activeStoryKey]) return null;
		return stories[activeStoryKey];
	}

	function clampFrameIndex(index, length) {
		if (!Number.isFinite(index)) return 0;
		const max = Math.max(0, length - 1);
		return Math.min(max, Math.max(0, index));
	}

	function updateViewButtons() {
		viewButtons.forEach((button) => {
			const mode = button.dataset.viewMode === 'single' ? 'single' : 'multi';
			const disabled = mode === 'single' && !ENABLE_SINGLE_VIEW;
			const isActive = button.dataset.viewMode === currentMode;
			button.classList.toggle('is-active', isActive);
			button.classList.toggle('is-disabled', disabled);
			button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
			button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
		});
	}

	function createTile(frame, frameIndex) {
		const tile = document.createElement('button');
		tile.type = 'button';
		tile.className = 'storyboard-tile';
		tile.dataset.frameIndex = String(frameIndex);
		tile.setAttribute('aria-label', `${frame.scene}, ${frame.shot}`);

		const meta = document.createElement('span');
		meta.className = 'storyboard-tile__meta';

		const scene = document.createElement('span');
		scene.textContent = frame.scene;
		const shot = document.createElement('span');
		shot.textContent = frame.shot;
		meta.append(scene, shot);

		const frameWrap = document.createElement('span');
		frameWrap.className = 'storyboard-tile__frame';
		const image = document.createElement('img');
		image.src = frame.image;
		image.alt = `${frame.scene} ${frame.shot}`;
		image.loading = 'lazy';
		frameWrap.append(image);

		const caption = document.createElement('p');
		caption.className = 'storyboard-tile__caption';
		caption.textContent = frame.caption;

		tile.append(meta, frameWrap, caption);
		return tile;
	}

	function setModalContent(node) {
		while (content.firstChild) {
			content.removeChild(content.firstChild);
		}
		content.appendChild(node);
	}

	function renderMultiView(story) {
		const grid = document.createElement('div');
		grid.className = 'storyboard-modal__grid';
		story.frames.forEach((frame, frameIndex) => {
			grid.append(createTile(frame, frameIndex));
		});
		setModalContent(grid);
	}

	function renderSingleView(story) {
		const frameCount = story.frames.length;
		activeFrameIndex = clampFrameIndex(activeFrameIndex, frameCount);
		const frame = story.frames[activeFrameIndex];

		if (!frame) {
			content.textContent = '';
			return;
		}

		const single = document.createElement('article');
		single.className = 'storyboard-modal__single';

		const meta = document.createElement('div');
		meta.className = 'storyboard-modal__single-meta';
		const scene = document.createElement('span');
		scene.textContent = frame.scene;
		const shot = document.createElement('span');
		shot.textContent = frame.shot;
		const index = document.createElement('span');
		index.className = 'storyboard-modal__single-index';
		index.textContent = `Frame ${activeFrameIndex + 1} of ${frameCount}`;
		meta.append(scene, shot, index);

		const frameWrap = document.createElement('div');
		frameWrap.className = 'storyboard-modal__single-frame';
		const image = document.createElement('img');
		image.src = frame.image;
		image.alt = `${frame.scene} ${frame.shot}`;
		frameWrap.append(image);

		const caption = document.createElement('p');
		caption.className = 'storyboard-modal__single-caption';
		caption.textContent = frame.caption;

		single.append(meta, frameWrap, caption);
		setModalContent(single);
	}

	function renderContent() {
		const story = getActiveStory();
		if (!story) return;
		if (currentMode === 'single') {
			renderSingleView(story);
			return;
		}
		renderMultiView(story);
	}

	function setMode(nextMode) {
		if (nextMode !== 'multi' && nextMode !== 'single') return;
		if (!ENABLE_SINGLE_VIEW && nextMode === 'single') return;
		if (currentMode === nextMode) return;
		currentMode = nextMode;
		updateViewButtons();
		renderContent();
	}

	function getFocusableElements() {
		const selectors = [
			'button:not([disabled])',
			'[href]',
			'input:not([disabled])',
			'select:not([disabled])',
			'textarea:not([disabled])',
			'[tabindex]:not([tabindex="-1"])'
		].join(', ');

		return Array.from(dialog.querySelectorAll(selectors)).filter((element) => {
			const style = window.getComputedStyle(element);
			return style.display !== 'none' && style.visibility !== 'hidden';
		});
	}

	function openModal(storyKey, sourceButton) {
		const story = stories[storyKey];
		if (!story) return;

		if (closeTimerId !== null) {
			window.clearTimeout(closeTimerId);
			closeTimerId = null;
		}

		activeStoryKey = storyKey;
		currentMode = 'multi';
		activeFrameIndex = 0;
		titleElement.textContent = story.title;
		updateViewButtons();
		renderContent();

		returnFocusTo = sourceButton || document.activeElement;

		if (!isOpen) {
			previousBodyOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			modal.hidden = false;
			requestAnimationFrame(() => modal.classList.add('is-open'));
			isOpen = true;
		} else {
			modal.classList.add('is-open');
		}

		window.setTimeout(() => {
			const preferredFocus = modal.querySelector('.storyboard-modal__view-btn.is-active') || viewButtons[0] || dialog;
			if (preferredFocus && typeof preferredFocus.focus === 'function') {
				preferredFocus.focus();
			}
		}, 0);
	}

	function closeModal() {
		if (!isOpen) return;
		isOpen = false;
		modal.classList.remove('is-open');
		document.body.style.overflow = previousBodyOverflow;

		closeTimerId = window.setTimeout(() => {
			modal.hidden = true;
			closeTimerId = null;
		}, 180);

		if (returnFocusTo && typeof returnFocusTo.focus === 'function') {
			window.setTimeout(() => {
				try {
					returnFocusTo.focus();
				} catch (error) {
					// ignore focus restore issues
				}
			}, 0);
		}
	}

	function onDocumentKeydown(event) {
		if (!isOpen) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			closeModal();
			return;
		}

		if (event.key !== 'Tab') return;

		const focusable = getFocusableElements();
		if (focusable.length === 0) {
			event.preventDefault();
			dialog.focus();
			return;
		}

		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;

		if (event.shiftKey) {
			if (active === first || !dialog.contains(active)) {
				event.preventDefault();
				last.focus();
			}
			return;
		}

		if (active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	triggerButtons.forEach((button) => {
		button.addEventListener('click', () => {
			openModal(button.dataset.storyboard, button);
		});
	});

	viewButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const nextMode = button.dataset.viewMode === 'single' ? 'single' : 'multi';
			setMode(nextMode);
		});
	});

	content.addEventListener('click', (event) => {
		if (!ENABLE_SINGLE_VIEW) return;
		if (currentMode !== 'multi') return;
		const tile = event.target.closest('.storyboard-tile');
		if (!tile) return;
		const activeStory = getActiveStory();
		const frameCount = activeStory ? activeStory.frames.length : 0;
		activeFrameIndex = clampFrameIndex(Number(tile.dataset.frameIndex), frameCount);
		setMode('single');
	});

	closeButton.addEventListener('click', closeModal);
	modal.addEventListener('click', (event) => {
		if (event.target === modal) {
			closeModal();
		}
	});

	document.addEventListener('keydown', onDocumentKeydown);
})();

	// Waitlist modal: opens from any "Join Waitlist" trigger.
	(function () {
		const modal = document.querySelector('.waitlist-modal');
		if (!modal) return;

		const dialog = modal.querySelector('.waitlist-modal__dialog');
		const closeButton = modal.querySelector('.waitlist-modal__close');
		const form = modal.querySelector('.waitlist-modal__form');
		const emailInput = modal.querySelector('#waitlist-email');
		const triggers = Array.from(document.querySelectorAll('[data-waitlist-trigger]'));

		if (!dialog || !closeButton || triggers.length === 0) return;

		let isOpen = false;
		let closeTimerId = null;
		let previousBodyOverflow = '';
		let returnFocusTo = null;

		function getFocusableElements() {
			const selectors = [
				'button:not([disabled])',
				'[href]',
				'input:not([disabled])',
				'select:not([disabled])',
				'textarea:not([disabled])',
				'[tabindex]:not([tabindex="-1"])'
			].join(', ');

			return Array.from(dialog.querySelectorAll(selectors)).filter((element) => {
				const style = window.getComputedStyle(element);
				return style.display !== 'none' && style.visibility !== 'hidden';
			});
		}

		function openModal(sourceButton) {
			if (closeTimerId !== null) {
				window.clearTimeout(closeTimerId);
				closeTimerId = null;
			}

			returnFocusTo = sourceButton || document.activeElement;

			if (!isOpen) {
				previousBodyOverflow = document.body.style.overflow;
				document.body.style.overflow = 'hidden';
				document.body.classList.add('waitlist-open');
				modal.hidden = false;
				requestAnimationFrame(() => modal.classList.add('is-open'));
				isOpen = true;
			} else {
				modal.classList.add('is-open');
			}

			window.setTimeout(() => {
				const preferredFocus = emailInput || dialog;
				if (preferredFocus && typeof preferredFocus.focus === 'function') {
					preferredFocus.focus();
				}
			}, 0);
		}

		function closeModal() {
			if (!isOpen) return;
			isOpen = false;
			modal.classList.remove('is-open');
			document.body.classList.remove('waitlist-open');
			document.body.style.overflow = previousBodyOverflow;

			closeTimerId = window.setTimeout(() => {
				modal.hidden = true;
				closeTimerId = null;
			}, 180);

			if (returnFocusTo && typeof returnFocusTo.focus === 'function') {
				window.setTimeout(() => {
					try {
						returnFocusTo.focus();
					} catch (error) {
						// ignore focus restore issues
					}
				}, 0);
			}
		}

		function onDocumentKeydown(event) {
			if (!isOpen) return;

			if (event.key === 'Escape') {
				event.preventDefault();
				closeModal();
				return;
			}

			if (event.key !== 'Tab') return;

			const focusable = getFocusableElements();
			if (focusable.length === 0) {
				event.preventDefault();
				dialog.focus();
				return;
			}

			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			const active = document.activeElement;

			if (event.shiftKey) {
				if (active === first || !dialog.contains(active)) {
					event.preventDefault();
					last.focus();
				}
				return;
			}

			if (active === last) {
				event.preventDefault();
				first.focus();
			}
		}

		triggers.forEach((trigger) => {
			trigger.addEventListener('click', (event) => {
				event.preventDefault();
				openModal(trigger);
			});
		});

		closeButton.addEventListener('click', closeModal);

		modal.addEventListener('click', (event) => {
			if (event.target === modal) {
				closeModal();
			}
		});

		if (form) {
			form.addEventListener('submit', (event) => {
				event.preventDefault();
				closeModal();
			});
		}

		document.addEventListener('keydown', onDocumentKeydown);
	})();
