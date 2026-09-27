import "solid-js";

declare module "solid-js" {
  namespace JSX {
    interface ExplicitBoolAttributes {
      /** HTML `inert`, written as an attribute (`bool:inert`) rather than a DOM property. */
      inert: boolean;
    }
  }
}
