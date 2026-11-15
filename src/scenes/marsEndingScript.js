// Mars -> Ending dialogue, split around the two certificates.
// Same format as MARS_TRANSITION_SCRIPT in main.js ({name} is replaced automatically).

export const MARS_ENDING_PART_1 = [
  {
    type: 'say',
    text: 'All three Martian targets are securely archived. Mission complete.',
    audio: '/assets/audio/Ending-1.mp3',
  },
  {
    type: 'say',
    text: 'Space Commander {name}! Come in, mission control! Our Deep Space Network tracking shows you’ve successfully visited the Sojourner Rover, Ingenuity Helicopter, and InSight Lander.',
    audio: '/assets/audio/Ending-2.mp3',
  },
  {
    type: 'say',
    text: 'You heard mission control! Re-engaging main thrusters, lifting off from Mars in 3… 2… 1… BLAST OFF!!!',
    audio: '/assets/audio/Ending-3.mp3',
  },
  {
    type: 'ask',
    text: 'Because you answered the call and completed both missions on the Moon and Mars, I hereby present you with your official Lunar & Mars Pioneer Certificate!',
    audio: '/assets/audio/Ending-4.mp3',
    acceptLabel: 'Accept certificate',
    declineLabel: 'Hear it again',
  },
];

export const MARS_ENDING_PART_2 = [
  {
    type: 'ask',
    text: 'But wait! We have one final surprise for you… Since you’ve honored every single silent hero across Mars and the Moon, you have unlocked NASA’s highest honor. You are now an ULTIMATE SPACE HISTORY KEEPER!',
    audio: '/assets/audio/Ending-5.mp3',
    acceptLabel: 'Accept certificate',
    declineLabel: 'Hear it again',
  },
];

export const MARS_ENDING_PART_3 = [
  {
    type: 'say',
    text: 'From all of us here at NASA and the ‘Remember Me’ Team: THANK YOU FOR YOUR SERVICE, SPACE COMMANDER {name}!',
    audio: '/assets/audio/Ending-6.mp3',
  },
  { type: 'say', text: 'Always remember: these landers and rovers may be left behind in space, but as long as explorers like you keep asking questions and sharing their stories, their history will NEVER be forgotten.', 
    audio: '/assets/audio/Ending-7.mp3' },
  {
    type: 'ask',
    text: 'Wear your achievement badge with pride, share your knowledge with your family and friends, and never stop reaching for the stars! ‘Til we meet again, Space Commander {name}!',
    audio: '/assets/audio/Ending-8.mp3',
    acceptLabel: 'Continue',
    declineLabel: 'Hear it again',
  },
];