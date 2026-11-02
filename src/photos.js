// Phones get every second photo: lighter on memory and a shorter scroll.
import all from './photos.json';
export default matchMedia('(max-width: 700px)').matches ? all.filter((_, i) => i % 2 === 0) : all;
