import type { Metadata } from "next";
import { PublicTutorialPage } from "@/components/payment-methods/public-tutorial-page";
import { PAYMENT_METHOD_TUTORIALS } from "@/components/payment-methods/tutorial-data";

export const metadata: Metadata = {
  title: "Tutorial Banco QR | J-Node Sales",
  description:
    "Guia para configurar Banco QR en J-Node Sales con datos bancarios y carga de imagen QR.",
};

export default function BancoQrTutorialPage() {
  const tutorial = PAYMENT_METHOD_TUTORIALS["banco-qr"];

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
