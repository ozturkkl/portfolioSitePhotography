export type PricingPackage = {
	id: string;
	name: string;
	price: string;
	description: string;
	features: string[];
};

export const pricingPackages: PricingPackage[] = [
	{
		id: 'wedding',
		name: 'Wedding',
		price: '$1,500',
		description: 'Full coverage for your wedding day, from preparation to celebration.',
		features: ['6 hours of coverage', '200–300 edited photos', '3-week delivery']
	},
	{
		id: 'engagement',
		name: 'Engagement',
		price: '$800',
		description: 'Celebrate the in-between - portraits before the big day.',
		features: ['3–4 hours of coverage', '170–200 edited photos', '2-week delivery']
	},
	{
		id: 'couple',
		name: 'Couple',
		price: '$350',
		description: 'Intimate portraits, just the two of you.',
		features: [
			'1–1.5 hours of coverage',
			'70–100 edited photos',
			'1-week delivery',
			'I can suggest locations'
		]
	},
	{
		id: 'family',
		name: 'Family',
		price: '$300',
		description: 'Timeless portraits with the people you love most.',
		features: [
			'1 hour of coverage',
			'50–70 edited photos',
			'1-week delivery',
			'I can suggest locations'
		]
	},
	{
		id: 'custom',
		name: 'Custom',
		price: "Let's talk",
		description: 'We’ll shape a package around your vision.',
		features: [
			'Tailored coverage and deliverables',
			'Elopements and intimate celebrations',
			'Commercial and editorial work'
		]
	}
];

export const defaultPackageId = 'custom';

export function isPackageSelectionId(id: string) {
	return pricingPackages.some((pkg) => pkg.id === id);
}
