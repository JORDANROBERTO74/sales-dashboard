import type { Metadata } from "next";
import { PublicTutorialPage } from "@/components/payment-methods/public-tutorial-page";
import { PAYMENT_METHOD_TUTORIALS } from "@/components/payment-methods/tutorial-data";

export const metadata: Metadata = {
  title: "Tutorial Binance | J-Node Sales",
  description:
    "Guia para configurar Binance en J-Node Sales con ID, codigo QR y activacion del metodo.",
};

export default function BinanceTutorialPage() {
  const tutorial = PAYMENT_METHOD_TUTORIALS.binance;

  return (
    <PublicTutorialPage
      methodName={tutorial.name}
      methodDescription={tutorial.shortDescription}
      methodPath={tutorial.path}
      prerequisites={tutorial.prerequisites}
      mobilePrerequisiteSteps={tutorial.mobilePrerequisiteSteps}
      jnodeFieldGuide={tutorial.jnodeFieldGuide}
      mobileNotes={tutorial.mobileNotes}
      sourceLinks={tutorial.sourceLinks}
      steps={tutorial.steps}
      commonErrors={tutorial.commonErrors}
      tips={tutorial.tips}
    />
  );
}
