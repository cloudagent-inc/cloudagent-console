const defaultTheme = require('tailwindcss/defaultTheme');

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'Inter Variable',
                    ...defaultTheme.fontFamily.sans
                ],
  			mono: [
  				'Roboto Mono Variable',
                    ...defaultTheme.fontFamily.mono
                ]
  		},
  				backgroundImage: {
			'cta-gradient': 'linear-gradient(95.92deg, #8EC2EB -27.44%, #2B85C6 68.44%)',
			'light-gradient': 'linear-gradient(83.66deg, rgba(228, 239, 250, 0.5) 15.51%, rgba(142, 194, 235, 0.5) 149.2%)'
		},
  		colors: {
  			primary: {
  				'50': '#F2FBFD',
  				'100': '#E4F4FA',
  				'200': '#C3E4F4',
  				'250': '#95C8E3',
  				'300': '#5D98AF',
  				'400': '#52A4DE',
  				'500': '#2A85C6',
  				'600': '#1C6DAD',
  				'700': '#184A74',
  				'800': '#112840',
  				'900': '#0F172A'
  			},
  			gray: {
  				'50': '#F7F8FA',
  				'100': '#EDEFF1',
  				'200': '#DBE4E0',
  				'250': '#BCBCBC',
  				'300': '#B9A2AA',
  				'400': '#777B84',
  				'500': '#676B85',
  				'600': '#595E73',
  				'700': '#474567',
  				'800': '#3D424F'
  			},
  			green: {
  				'50': '#EBF9EA',
  				'400': '#34A853',
  				'500': '#1D9714'
  			},
  			red: {
  				'50': '#FFF3F2',
  				'100': '#FFDCDA',
  				'200': '#FDA29B',
  				'400': '#EA4335',
  				'600': '#B42318'
  			},
  			yellow: {
  				'50': '#FFFAEB',
  				'100': '#FEF0C7',
  				'400': '#FBBC04',
  				'600': '#D58A00'
  			},
  						highlight: {
				blue: '#42B0FF',
				limeGreen: '#4AE640'
			},
  						'cta-blue': '#2B85C6',
			'cta-light': '#8EC2EB',
			'light-blue': '#E4EFFA'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'pulse-glow': {
  				'0%, 100%': {
  					boxShadow: '0 0 10px rgba(59, 130, 246, 0.4), 0 0 20px rgba(59, 130, 246, 0.2)'
  				},
  				'50%': {
  					boxShadow: '0 0 20px rgba(59, 130, 246, 0.6), 0 0 30px rgba(59, 130, 246, 0.4)'
  				}
  			},
  			'marquee': {
  				from: { transform: 'translateX(0)' },
  				to: { transform: 'translateX(-50%)' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
  			'marquee': 'marquee 30s linear infinite'
  		}
  	}
  },
  plugins: [import('tailwindcss-animate')],
};
