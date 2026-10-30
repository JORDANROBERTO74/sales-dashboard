import type { Metadata } from "next";
import { PublicTutorialPage } from "@/components/payment-methods/public-tutorial-page";
import { PAYMENT_METHOD_TUTORIALS } from "@/components/payment-methods/tutorial-data";
import { BRAND } from "@/config/brand";

export const metadata: Metadata = {
  title: `Tutorial Airtm | ${BRAND.appName}`,
  description: `Guia para configurar Airtm en ${BRAND.appName} con datos ACH y habilitacion de retiros.`,
};

export default function AirtmTutorialPage() {
  const tutorial = PAYMENT_METHOD_TUTORIALS.airtm;

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
