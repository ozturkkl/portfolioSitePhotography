export const site = {
	name: 'Ilayda Turkmen',
	brandName: 'ilayda turkmen',
	headline: 'Your story captured with passion',
	homeAbout: {
		intro:
			'One of my biggest passions is to document people in their real, unfiltered moments. When I see people laughing together, sipping their coffee, walking down the street holding hands, running somewhere, escaping the rain, I immediately think, "That would make a great photograph."'
	},
	about: {
		greeting: 'Hi, I\'m Ilayda Turkmen.',
		intro:
			"I was born and raised in Turkey and currently live in Chicago. Throughout my life, I've had the opportunity to live in different cultures, meet people from all walks of life, and experience many different environments. I've always been observant and curious, noticing the details in my surroundings wherever I've been.",
		paragraphs: [
			"During my freshman year of college, my dad gifted me my first DSLR camera, and that's where my photography journey really began.",
			'There was a skate park near my house that I passed by almost every day. I remember thinking that every corner of that park, filled with unique people, looked like a scene straight out of a photograph. One day, I grabbed my camera and spent hours photographing people skating, talking to each other, laughing…',
			'After that, I started going to New York City often and spent a lot of time doing street photography. I love telling stories through my photos. One of my biggest passions is to document people in their real, unfiltered moments. When I see people laughing together, sipping their coffee, walking down the street holding hands, running somewhere, escaping the rain, I immediately think, "That would make a great photograph." I can spend hours trying to capture a single moment.',
			"I've been behind the camera for over 6 years, and my approach is simple: capturing real emotions and life."
		],
		cta: "Let's chat!",
		quote:
			'I was used to looking at the world through a rectangular window, and it will always continue that way'
	},
	contact: {
		email: '97ilaydaturkmen@gmail.com',
		instagram: '@ilaydashoots',
		instagramUrl: 'https://www.instagram.com/ilaydashoots/'
	},
	footer: {
		note: "Hi there - thanks for stopping by. I'm so glad you're here, and I'd love to hear from you anytime."
	}
} as const;

export const navLinks = [
	{ href: '/about', label: 'About' },
	{ href: '/portfolio', label: 'Portfolio' },
	{ href: '/pricing', label: 'Pricing' },
	{ href: '/contact', label: 'Contact' }
] as const;

export function pageTitle(page: string): string {
	return `${page} - ${site.name}`;
}
