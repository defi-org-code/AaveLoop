import chai from "chai";
import BN from "bn.js";

before(() => {
  chai.use(require("chai-bn")(BN));
});

declare global {
  export namespace Chai {
    export interface BNComparer extends NumberComparer {
      (value: BN | string, message?: string): BNAssertion;
    }
    export interface BNCloseTo extends CloseTo {
      (value: BN | string, delta: BN | string, message?: string): BNAssertion;
    }
    export interface BNBoolean {
      (): BNAssertion;
    }
    export interface BNAssertion extends Assertion {
      equal: BNComparer;
      equals: BNComparer;
      eq: BNComparer;
      above: BNComparer;
      gt: BNComparer;
      greaterThan: BNComparer;
      least: BNComparer;
      gte: BNComparer;
      below: BNComparer;
      lt: BNComparer;
      lessThan: BNComparer;
      most: BNComparer;
      lte: BNComparer;
      closeTo: BNCloseTo;
      negative: BNBoolean;
      zero: BNBoolean;
    }
    export interface Assertion {
      bignumber: BNAssertion;
    }
  }
}
