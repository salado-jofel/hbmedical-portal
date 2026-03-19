import { Hero } from "./(sections)/Hero";
import { Navbar } from "./(sections)/Navbar";
import { Footer } from "./(sections)/Footer";
import { GettingStarted } from "./(sections)/GettingStarted";
import { LiveDemo } from "./(sections)/LiveDemo";
import { Testimonials } from "./(sections)/Testimonials";
import { WhyUs } from "./(sections)/WhyUs";
import { Product } from "./(sections)/Product";

export default function Home() {


  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <Product />
      <WhyUs />
      <Testimonials />
      <GettingStarted />
      <LiveDemo />
      <Footer />
    </main>
  );
}
