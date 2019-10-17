import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faTimes } from "@fortawesome/free-solid-svg-icons";
import PropTypes from "prop-types";
import useKeyPress from "../hooks/useKeyPress";
import useIpcRenderer from "../hooks/useIpcRenderer";

const FileSearch = ({ title, onFileSearch }) => {
  const [inputActive, setInputActive] = useState(false);
  const [value, setValue] = useState("");

  const enterPressed = useKeyPress(13);
  const escPressed = useKeyPress(27);

  let node = useRef(null);

  const searchClick = () => {
    setInputActive(true);
  };

  const closeSearch = () => {
    setInputActive(false);
    setValue("");
    onFileSearch("");
  };

  useEffect(() => {
    // const handelInputEvent = event => {
    //   const { keyCode } = event;
    //   if (keyCode === 13 && inputActive) {
    //     onFileSearch(value);
    //   } else if (keyCode === 27 && inputActive) {
    //     closeSearch(event);
    //   }
    // };
    // document.addEventListener("keyup", handelInputEvent);
    // return () => {
    //   document.removeEventListener("keyup", handelInputEvent);
    // };
    if (enterPressed && inputActive) {
      onFileSearch(value);
    }
    if (escPressed && inputActive) {
      closeSearch();
    }
  });

  useEffect(() => {
    if (inputActive) {
      node.current.focus();
    }
  }, [inputActive]);

  useIpcRenderer({
    "search-file": searchClick
  });

  return (
    <div className="alert alert-primary d-flex justify-content-between align-items-center mb-0">
      {!inputActive && (
        <>
          <span>{title}</span>
          <button type="button" className="icon-button" onClick={searchClick}>
            <FontAwesomeIcon size="lg" title="搜索" icon={faSearch} />
          </button>
        </>
      )}
      {inputActive && (
        <>
          <input
            className="form-control"
            value={value}
            ref={node}
            onChange={e => {
              setValue(e.target.value);
            }}
          ></input>
          <button className="icon-button" onClick={closeSearch}>
            <FontAwesomeIcon size="lg" title="关闭" icon={faTimes} />
          </button>
        </>
      )}
    </div>
  );
};

FileSearch.propTypes = {
  title: PropTypes.string,
  onFileSearch: PropTypes.func.isRequired
};

FileSearch.defaultProps = {
  title: "我的云文档"
};

export default FileSearch;
