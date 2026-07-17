import {ReactRunner} from "@chub-ai/stages-ts";
import {Stage} from "./Stage";

function App() {
  console.info(`Running in ${import.meta.env.MODE}`);

  return <ReactRunner factory={(data: any) => new Stage(data)} />;
}

export default App
